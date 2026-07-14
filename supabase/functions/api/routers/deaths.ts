// Port of backend/app/routers/deaths.py.
//
// Employee-self-only restriction (list/export/get): employees only ever see
// their OWN death reports; managers see every report in the farm. This is
// finer-grained than plain farm scoping — every read query below adds an
// `and reported_by_user_id = <employee id>` clause when the caller is not a
// manager, mirroring the SQLAlchemy `.filter(...)` chains in the Python
// router exactly.
import { Hono } from "hono";
import { getDb, isUniqueViolation } from "../../_shared/db.ts";
import { parsePagination } from "../../_shared/pagination.ts";
import {
  csvResponse,
  jsonError,
  pageEnvelope,
} from "../../_shared/response.ts";
import { recordAudit } from "../../_shared/auditService.ts";
import { requireAuth } from "../../_shared/auth.ts";
import {
  DeathRecordFormSchema,
  firstZodError,
} from "../../_shared/validation.ts";
import {
  DuplicateImageError,
  imageHashExists,
  ImageValidationError,
  processDeathImage,
} from "../../_shared/imageService.ts";
import {
  deleteObject,
  saveObject,
  signedUrl,
} from "../../_shared/storageService.ts";

interface DeathRecordRow {
  id: number;
  farm_id: number;
  animal_id: number;
  reported_by_user_id: number;
  cause_of_death: string;
  date_of_death: Date | string;
  image_path: string;
  image_hash: string;
  notes: string | null;
  created_at: Date | string;
}

interface DeathRecordResponse {
  id: number;
  farm_id: number;
  animal_id: number;
  reported_by_user_id: number;
  cause_of_death: string;
  date_of_death: string;
  image_path: string;
  notes: string | null;
  created_at: Date | string;
}

interface AnimalRow {
  id: number;
  name: string;
  status: "alive" | "dead";
}

// Postgres `date` columns come back as JS Date objects (UTC midnight); the
// Python response model serializes date_of_death as a bare "YYYY-MM-DD", so
// normalize the same way here rather than emitting a full ISO timestamp.
function toDateOnly(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export interface DeathsRouterDeps {
  /** Injection point for tests — defaults to the real Supabase Storage save. */
  saveFn?: typeof saveObject;
  /** Injection point for tests — defaults to the real Supabase Storage delete. */
  deleteFn?: typeof deleteObject;
  /** Injection point for tests — defaults to the real signed-URL resolver. */
  resolveUrl?: typeof signedUrl;
}

const HASH_LENGTH = 64;

export function createDeathsRouter(deps: DeathsRouterDeps = {}): Hono {
  const saveFn = deps.saveFn ?? saveObject;
  const deleteFn = deps.deleteFn ?? deleteObject;
  const resolveUrl = deps.resolveUrl ?? signedUrl;

  const router = new Hono();

  async function toResponse(
    record: DeathRecordRow,
  ): Promise<DeathRecordResponse> {
    return {
      id: record.id,
      farm_id: record.farm_id,
      animal_id: record.animal_id,
      reported_by_user_id: record.reported_by_user_id,
      cause_of_death: record.cause_of_death,
      date_of_death: toDateOnly(record.date_of_death),
      image_path: await resolveUrl(record.image_path),
      notes: record.notes,
      created_at: record.created_at,
    };
  }

  router.get("/check-hash", requireAuth, async (c) => {
    const hash = c.req.query("hash") ?? "";
    if (hash.length !== HASH_LENGTH) {
      return jsonError(
        c,
        422,
        `hash: String should have exactly ${HASH_LENGTH} characters`,
      );
    }
    const user = c.get("user");
    const exists = await imageHashExists(user.farm_id, hash);
    return c.json({ exists });
  });

  router.get("/export.csv", requireAuth, async (c) => {
    const user = c.get("user");
    const sql = getDb();
    const scopeFilter = user.role !== "manager"
      ? sql`and reported_by_user_id = ${user.id}`
      : sql``;
    const records = await sql<DeathRecordRow[]>`
      select * from death_records
      where farm_id = ${user.farm_id}
      ${scopeFilter}
      order by created_at desc
    `;
    const header = [
      "id",
      "animal_id",
      "reported_by_user_id",
      "cause_of_death",
      "date_of_death",
      "notes",
      "created_at",
    ];
    const rows = records.map((r) => [
      r.id,
      r.animal_id,
      r.reported_by_user_id,
      r.cause_of_death,
      toDateOnly(r.date_of_death),
      r.notes ?? "",
      r.created_at,
    ]);
    return csvResponse(c, "deaths.csv", header, rows);
  });

  router.get("", requireAuth, async (c) => {
    const user = c.get("user");
    const paged = parsePagination(c);
    if (!paged.ok) return jsonError(c, 422, paged.error);
    const { page, limit, offset } = paged.pagination;

    const sql = getDb();
    const scopeFilter = user.role !== "manager"
      ? sql`and reported_by_user_id = ${user.id}`
      : sql``;

    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from death_records
      where farm_id = ${user.farm_id}
      ${scopeFilter}
    `;
    const records = await sql<DeathRecordRow[]>`
      select * from death_records
      where farm_id = ${user.farm_id}
      ${scopeFilter}
      order by created_at desc
      offset ${offset} limit ${limit}
    `;
    const items = await Promise.all(records.map((r) => toResponse(r)));
    return c.json(pageEnvelope(items, count, page, limit));
  });

  router.post("", requireAuth, async (c) => {
    const user = c.get("user");

    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return jsonError(c, 422, "file: Field required");
    }

    const parsed = DeathRecordFormSchema.safeParse({
      animal_id: body.animal_id,
      cause_of_death: body.cause_of_death,
      date_of_death: body.date_of_death,
      notes: body.notes,
    });
    if (!parsed.success) return jsonError(c, 422, firstZodError(parsed));
    const {
      animal_id: animalId,
      cause_of_death: causeOfDeath,
      date_of_death: dateOfDeath,
      notes,
    } = parsed.data;

    const sql = getDb();

    const [animal] = await sql<AnimalRow[]>`
      select id, name, status from animals where id = ${animalId} and farm_id = ${user.farm_id}
    `;
    if (!animal) return jsonError(c, 404, "Animal not found");

    if (animal.status !== "alive") {
      return jsonError(
        c,
        400,
        `Animal '${animal.name}' is already recorded as dead`,
      );
    }

    const [existingRecord] = await sql<{ id: number }[]>`
      select id from death_records where animal_id = ${animalId}
    `;
    if (existingRecord) {
      return jsonError(c, 400, "A death record already exists for this animal");
    }

    const contents = new Uint8Array(await file.arrayBuffer());
    let imageRef: string;
    let imageHash: string;
    try {
      const result = await processDeathImage(
        file.type,
        contents,
        user.farm_id,
        saveFn,
      );
      imageRef = result.imageRef;
      imageHash = result.imageHash;
    } catch (err) {
      if (err instanceof DuplicateImageError) {
        return jsonError(c, 409, err.message);
      }
      if (err instanceof ImageValidationError) {
        return jsonError(c, 400, err.message);
      }
      throw err;
    }

    let record: DeathRecordRow;
    try {
      [record] = await sql.begin(async (tx) => {
        const [rec] = await tx<DeathRecordRow[]>`
          insert into death_records
            (farm_id, animal_id, reported_by_user_id, cause_of_death, date_of_death, image_path, image_hash, notes)
          values
            (${user.farm_id}, ${animalId}, ${user.id}, ${causeOfDeath}, ${dateOfDeath}, ${imageRef}, ${imageHash}, ${
          notes ?? null
        })
          returning *
        `;
        await tx`update animals set status = 'dead', updated_at = now() where id = ${animalId}`;
        return [rec];
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        // DB unique constraints (one record per animal, per-farm image hash)
        // are authoritative under concurrency. If a racing request beat us,
        // drop the object we just wrote and report 409.
        await deleteFn(imageRef);
        return jsonError(
          c,
          409,
          "A death report for this animal or image already exists",
        );
      }
      throw err;
    }

    await recordAudit({
      c,
      actor: user,
      action: "create",
      entityType: "death_record",
      entityId: record.id,
      details: { animal_id: animalId, cause_of_death: causeOfDeath },
    });

    return c.json(await toResponse(record), 201);
  });

  router.get("/:id", requireAuth, async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) {
      return jsonError(c, 422, "id: Invalid record id");
    }

    const user = c.get("user");
    const sql = getDb();
    const [record] = await sql<DeathRecordRow[]>`
      select * from death_records where id = ${id} and farm_id = ${user.farm_id}
    `;
    if (!record) return jsonError(c, 404, "Death record not found");

    if (user.role !== "manager" && record.reported_by_user_id !== user.id) {
      return jsonError(
        c,
        403,
        "You do not have permission to view this record",
      );
    }

    return c.json(await toResponse(record));
  });

  return router;
}

export const deathsRouter = createDeathsRouter();
