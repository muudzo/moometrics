// Port of backend/app/routers/animals.py.
import { Hono } from "hono";
import { getDb, isUniqueViolation } from "../../_shared/db.ts";
import { parsePagination } from "../../_shared/pagination.ts";
import {
  csvResponse,
  jsonError,
  pageEnvelope,
} from "../../_shared/response.ts";
import { recordAudit } from "../../_shared/auditService.ts";
import { requireAuth, requireManager } from "../../_shared/auth.ts";
import {
  AnimalCreateSchema,
  AnimalUpdateSchema,
  firstZodError,
} from "../../_shared/validation.ts";

const TAG_TAKEN = "Tag number is already assigned to another animal";
const NOT_FOUND = "Animal not found";

export const animalsRouter = new Hono();

// Every route in this router requires an authenticated user; there is no
// public animals endpoint (matches app/routers/animals.py, which depends on
// get_current_user for all routes and require_manager additionally for delete).
animalsRouter.use("*", requireAuth);

interface AnimalRow {
  id: number;
  farm_id: number;
  name: string;
  animal_type: string;
  tag_number: string | null;
  breed: string | null;
  // Cast to text in every query below — postgres.js otherwise returns `date`
  // columns as JS Date objects at UTC midnight, which JSON.stringify renders
  // as a full "...T00:00:00.000Z" timestamp instead of Pydantic's plain
  // "YYYY-MM-DD" string. Casting keeps the wire format identical to the
  // FastAPI original and avoids timezone-shift bugs.
  date_of_birth: string | null;
  status: "alive" | "dead";
  notes: string | null;
  added_by_user_id: number;
  created_at: Date;
  updated_at: Date;
}

const UPDATABLE_FIELDS = [
  "name",
  "animal_type",
  "tag_number",
  "breed",
  "date_of_birth",
  "status",
  "notes",
] as const;

function parseAnimalId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  return parseInt(raw, 10);
}

/** Fetch an animal within the caller's farm, or null (mirrors _get_owned_animal). */
async function getOwnedAnimal(
  animalId: number,
  farmId: number,
): Promise<AnimalRow | null> {
  const sql = getDb();
  const [animal] = await sql<AnimalRow[]>`
    select id, farm_id, name, animal_type, tag_number, breed,
           date_of_birth::text as date_of_birth, status, notes,
           added_by_user_id, created_at, updated_at
    from animals
    where id = ${animalId} and farm_id = ${farmId}
  `;
  return animal ?? null;
}

animalsRouter.get("/", async (c) => {
  const user = c.get("user");
  const paged = parsePagination(c);
  if (!paged.ok) return jsonError(c, 422, paged.error);
  const { page, limit, offset } = paged.pagination;

  const sql = getDb();
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*) as count from animals where farm_id = ${user.farm_id}
  `;
  const items = await sql<AnimalRow[]>`
    select id, farm_id, name, animal_type, tag_number, breed,
           date_of_birth::text as date_of_birth, status, notes,
           added_by_user_id, created_at, updated_at
    from animals
    where farm_id = ${user.farm_id}
    order by created_at desc
    offset ${offset} limit ${limit}
  `;
  return c.json(pageEnvelope(items, parseInt(count, 10), page, limit));
});

animalsRouter.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = AnimalCreateSchema.safeParse(body);
  if (!parsed.success) return jsonError(c, 422, firstZodError(parsed));
  const data = parsed.data;

  const sql = getDb();

  // App-level pre-check for a friendlier error in the common (non-racy) case;
  // the per-farm unique constraint (uq_animal_farm_tag) is the source of
  // truth and is still guarded below via isUniqueViolation.
  if (data.tag_number) {
    const [existing] = await sql<{ id: number }[]>`
      select id from animals
      where farm_id = ${user.farm_id} and tag_number = ${data.tag_number}
    `;
    if (existing) return jsonError(c, 409, TAG_TAKEN);
  }

  let animal: AnimalRow;
  try {
    [animal] = await sql<AnimalRow[]>`
      insert into animals (
        farm_id, name, animal_type, tag_number, breed, date_of_birth, notes,
        added_by_user_id, status
      )
      values (
        ${user.farm_id}, ${data.name}, ${data.animal_type},
        ${data.tag_number ?? null}, ${data.breed ?? null},
        ${data.date_of_birth ?? null}, ${data.notes ?? null},
        ${user.id}, 'alive'
      )
      returning id, farm_id, name, animal_type, tag_number, breed,
                date_of_birth::text as date_of_birth, status, notes,
                added_by_user_id, created_at, updated_at
    `;
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(c, 409, TAG_TAKEN);
    throw err;
  }

  await recordAudit({
    c,
    actor: user,
    action: "create",
    entityType: "animal",
    entityId: animal.id,
    details: { name: animal.name, tag_number: animal.tag_number },
  });

  return c.json(animal, 201);
});

animalsRouter.get("/export.csv", async (c) => {
  const user = c.get("user");
  const sql = getDb();
  const animals = await sql<AnimalRow[]>`
    select id, name, animal_type, tag_number, breed,
           date_of_birth::text as date_of_birth, status, notes, created_at
    from animals
    where farm_id = ${user.farm_id}
    order by created_at desc
  `;
  const header = [
    "id",
    "name",
    "animal_type",
    "tag_number",
    "breed",
    "date_of_birth",
    "status",
    "notes",
    "created_at",
  ];
  const rows = animals.map((a) => [
    a.id,
    a.name,
    a.animal_type,
    a.tag_number ?? "",
    a.breed ?? "",
    a.date_of_birth ?? "",
    a.status,
    a.notes ?? "",
    // .toISOString() rather than Python's bare str(datetime): the raw JS
    // Date's default toString() ("Mon Jan 01 2024 ...") has no Python
    // equivalent worth matching, so we emit a stable, parseable timestamp.
    a.created_at.toISOString(),
  ]);
  return csvResponse(c, "animals.csv", header, rows);
});

animalsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = parseAnimalId(c.req.param("id"));
  if (id === null) {
    return jsonError(c, 422, "animal_id: Input should be a valid integer");
  }
  const animal = await getOwnedAnimal(id, user.farm_id);
  if (!animal) return jsonError(c, 404, NOT_FOUND);
  return c.json(animal);
});

animalsRouter.put("/:id", async (c) => {
  const user = c.get("user");
  const id = parseAnimalId(c.req.param("id"));
  if (id === null) {
    return jsonError(c, 422, "animal_id: Input should be a valid integer");
  }

  const existing = await getOwnedAnimal(id, user.farm_id);
  if (!existing) return jsonError(c, 404, NOT_FOUND);

  const raw = await c.req.json().catch(() => null);
  if (raw === null || typeof raw !== "object") {
    return jsonError(c, 422, "Invalid request body");
  }
  const parsed = AnimalUpdateSchema.safeParse(raw);
  if (!parsed.success) return jsonError(c, 422, firstZodError(parsed));

  if (parsed.data.status === "dead" && user.role !== "manager") {
    return jsonError(
      c,
      403,
      "Only managers can directly set status to 'dead'. Use the death report endpoint.",
    );
  }

  // Mirror Pydantic's model_dump(exclude_unset=True): only fields explicitly
  // present in the request body are applied — fields the client omitted must
  // leave the stored value untouched, even though Zod fills in `optional()`
  // fields as undefined either way.
  const rawObject = raw as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  for (const field of UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(rawObject, field)) {
      updateData[field] = (parsed.data as Record<string, unknown>)[field];
    }
  }

  const sql = getDb();

  if (updateData.tag_number) {
    const [clash] = await sql<{ id: number }[]>`
      select id from animals
      where farm_id = ${user.farm_id}
        and tag_number = ${updateData.tag_number as string}
        and id != ${id}
    `;
    if (clash) return jsonError(c, 409, TAG_TAKEN);
  }

  let updated: AnimalRow;
  try {
    const columns = Object.keys(updateData);
    if (columns.length > 0) {
      [updated] = await sql<AnimalRow[]>`
        update animals set ${sql(updateData, ...columns)}, updated_at = now()
        where id = ${id} and farm_id = ${user.farm_id}
        returning id, farm_id, name, animal_type, tag_number, breed,
                  date_of_birth::text as date_of_birth, status, notes,
                  added_by_user_id, created_at, updated_at
      `;
    } else {
      // No recognized fields were present in the body — still bump
      // updated_at, matching the Python handler which always sets
      // animal.updated_at = utcnow() before committing, even on a no-op body.
      [updated] = await sql<AnimalRow[]>`
        update animals set updated_at = now()
        where id = ${id} and farm_id = ${user.farm_id}
        returning id, farm_id, name, animal_type, tag_number, breed,
                  date_of_birth::text as date_of_birth, status, notes,
                  added_by_user_id, created_at, updated_at
      `;
    }
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(c, 409, TAG_TAKEN);
    throw err;
  }

  await recordAudit({
    c,
    actor: user,
    action: "update",
    entityType: "animal",
    entityId: updated.id,
    details: updateData,
  });

  return c.json(updated);
});

animalsRouter.delete("/:id", requireManager, async (c) => {
  const user = c.get("user");
  const id = parseAnimalId(c.req.param("id"));
  if (id === null) {
    return jsonError(c, 422, "animal_id: Input should be a valid integer");
  }

  const existing = await getOwnedAnimal(id, user.farm_id);
  if (!existing) return jsonError(c, 404, NOT_FOUND);

  const sql = getDb();
  await sql`delete from animals where id = ${id} and farm_id = ${user.farm_id}`;

  await recordAudit({
    c,
    actor: user,
    action: "delete",
    entityType: "animal",
    entityId: id,
  });

  return c.body(null, 204);
});
