// Port of backend/app/services/audit_service.py. Best-effort: never throws,
// so a failure to write an audit row never breaks the caller's action.
import type { Context } from "hono";
import { getDb } from "./db.ts";
import type { AuthUser } from "./auth.ts";

function clientIp(c: Context | null): string | null {
  if (!c) return null;
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64);
  return null;
}

export interface RecordAuditParams {
  c: Context | null;
  actor: AuthUser | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  farmId?: number | null;
  details?: Record<string, unknown> | null;
}

export async function recordAudit(params: RecordAuditParams): Promise<void> {
  const resolvedFarm = params.farmId ?? params.actor?.farm_id ?? null;
  if (resolvedFarm === null) {
    console.warn(
      `Skipping audit '${params.action}' on ${params.entityType}: no farm context`,
    );
    return;
  }
  try {
    const sql = getDb();
    await sql`
      insert into audit_logs
        (farm_id, actor_user_id, actor_username, action, entity_type, entity_id, details, ip)
      values (
        ${resolvedFarm},
        ${params.actor?.id ?? null},
        ${params.actor?.username ?? null},
        ${params.action},
        ${params.entityType},
        ${params.entityId ?? null},
        ${params.details ? JSON.stringify(params.details) : null},
        ${clientIp(params.c)}
      )
    `;
  } catch (err) {
    console.error(
      `Failed to write audit log for ${params.entityType}/${params.action}:`,
      err,
    );
  }
}
