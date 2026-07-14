// Port of backend/app/routers/users.py.
import { Hono } from "hono";
import { getDb, isForeignKeyViolation } from "../../_shared/db.ts";
import { jsonError } from "../../_shared/response.ts";
import { recordAudit } from "../../_shared/auditService.ts";
import { requireAuth, requireManager } from "../../_shared/auth.ts";

export const usersRouter = new Hono();

interface UserResponseRow {
  id: number;
  username: string;
  role: "manager" | "employee";
  farm_id: number;
  created_at: Date;
}

usersRouter.get("", requireAuth, requireManager, async (c) => {
  const manager = c.get("user");
  const sql = getDb();
  const rows = await sql<UserResponseRow[]>`
    select id, username, role, farm_id, created_at
    from users
    where farm_id = ${manager.farm_id}
    order by created_at asc
  `;
  return c.json(rows);
});

usersRouter.delete("/:userId", requireAuth, requireManager, async (c) => {
  const manager = c.get("user");
  const rawId = c.req.param("userId");
  if (!/^\d+$/.test(rawId)) {
    return jsonError(c, 404, "User not found");
  }
  const userId = parseInt(rawId, 10);

  if (userId === manager.id) {
    return jsonError(c, 400, "You cannot delete your own account");
  }

  const sql = getDb();
  const [user] = await sql<{ id: number }[]>`
    select id from users where id = ${userId} and farm_id = ${manager.farm_id}
  `;
  if (!user) {
    return jsonError(c, 404, "User not found");
  }

  try {
    await sql.begin(async (tx) => {
      // Sessions are safe to destroy with the account; without this, any user
      // who had ever logged in was undeletable (refresh_tokens FK -> 500).
      await tx`delete from refresh_tokens where user_id = ${userId}`;
      await tx`delete from users where id = ${userId}`;
    });
  } catch (err) {
    // animals.added_by_user_id / death_records.reported_by_user_id still
    // reference this user. Those records must not be silently orphaned or
    // cascaded away — they're the farm's history — so refuse cleanly instead
    // of surfacing a raw FK violation as a 500.
    if (isForeignKeyViolation(err)) {
      return jsonError(
        c,
        409,
        "This user has recorded animals or death reports and cannot be " +
          "deleted without losing that history. Reassign or keep the account.",
      );
    }
    throw err;
  }

  await recordAudit({
    c,
    actor: manager,
    action: "delete",
    entityType: "user",
    entityId: userId,
  });
  return c.body(null, 204);
});
