// Port of backend/app/routers/audit.py.
import { Hono } from "hono";
import { getDb } from "../../_shared/db.ts";
import { jsonError, pageEnvelope } from "../../_shared/response.ts";
import { requireAuth, requireManager } from "../../_shared/auth.ts";

export const auditRouter = new Hono();

interface AuditLogRow {
  id: number;
  actor_user_id: number | null;
  actor_username: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  // The postgres.js npm-compat build used here returns jsonb columns as raw
  // text rather than auto-parsing them (verified empirically against this
  // driver/runtime combo), so `details` arrives as a JSON string and must be
  // parsed explicitly below before it reaches the response.
  details: string | null;
  ip: string | null;
  created_at: Date;
}

/** Mirrors FastAPI's Query(1, ge=1) / Query(50, ge=1, le=200): missing param
 * falls back to the default, present-but-out-of-range is a 422. */
function parseBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
  field: string,
): { value: number } | { error: string } {
  if (raw === undefined) return { value: fallback };
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    const bound = max === Infinity
      ? `greater than or equal to ${min}`
      : `between ${min} and ${max}`;
    return { error: `${field}: Input should be ${bound}` };
  }
  return { value: parsed };
}

// Return this farm's audit log, most recent first (paginated).
auditRouter.get("", requireAuth, requireManager, async (c) => {
  const manager = c.get("user");

  const pageResult = parseBoundedInt(
    c.req.query("page"),
    1,
    1,
    Infinity,
    "page",
  );
  if ("error" in pageResult) return jsonError(c, 422, pageResult.error);
  const page = pageResult.value;

  const limitResult = parseBoundedInt(
    c.req.query("limit"),
    50,
    1,
    200,
    "limit",
  );
  if ("error" in limitResult) return jsonError(c, 422, limitResult.error);
  const limit = limitResult.value;

  const sql = getDb();
  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count from audit_logs where farm_id = ${manager.farm_id}
  `;
  const total = Number(count);

  const rows = await sql<AuditLogRow[]>`
    select id, actor_user_id, actor_username, action, entity_type, entity_id, details, ip, created_at
    from audit_logs
    where farm_id = ${manager.farm_id}
    order by created_at desc
    offset ${(page - 1) * limit}
    limit ${limit}
  `;
  const items = rows.map((row) => ({
    ...row,
    details: row.details === null
      ? null
      : JSON.parse(row.details) as Record<string, unknown>,
  }));

  return c.json(pageEnvelope(items, total, page, limit));
});
