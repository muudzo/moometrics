// Port of backend/app/routers/users.py.
import { Hono } from "hono";
import { getDb } from "../../_shared/db.ts";
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
  const userId = parseInt(c.req.param("userId"), 10);
  if (Number.isNaN(userId)) {
    return jsonError(c, 404, "User not found");
  }

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

  await sql`delete from users where id = ${userId}`;
  await recordAudit({
    c,
    actor: manager,
    action: "delete",
    entityType: "user",
    entityId: userId,
  });
  return c.body(null, 204);
});
