// Port of backend/app/routers/audit.py.
import { Hono } from "hono";
import { getDb, parseJsonbText } from "../../_shared/db.ts";
import { jsonError, pageEnvelope } from "../../_shared/response.ts";
import { requireAuth, requireManager } from "../../_shared/auth.ts";
import { parsePagination } from "../../_shared/pagination.ts";

export const auditRouter = new Hono();

interface AuditLogRow {
  id: number;
  actor_user_id: number | null;
  actor_username: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  // jsonb arrives as raw text from this driver — see parseJsonbText in db.ts.
  details: string | null;
  ip: string | null;
  created_at: Date;
}

// Return this farm's audit log, most recent first (paginated).
auditRouter.get("", requireAuth, requireManager, async (c) => {
  const manager = c.get("user");

  const paged = parsePagination(c);
  if (!paged.ok) return jsonError(c, 422, paged.error);
  const { page, limit, offset } = paged.pagination;

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
    offset ${offset}
    limit ${limit}
  `;
  const items = rows.map((row) => ({
    ...row,
    details: parseJsonbText(row.details),
  }));

  return c.json(pageEnvelope(items, total, page, limit));
});
