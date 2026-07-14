// Port of backend/app/routers/auth.py.
import { Hono } from "hono";
import { getDb, isUniqueViolation } from "../../_shared/db.ts";
import { jsonError } from "../../_shared/response.ts";
import { rateLimit } from "../../_shared/rateLimit.ts";
import { recordAudit } from "../../_shared/auditService.ts";
import {
  type AuthUser,
  clearRefreshCookie,
  createAccessToken,
  hashPassword,
  issueRefreshToken,
  requireAuth,
  requireManager,
  resolveRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  setRefreshCookie,
  verifyPassword,
  verifyPasswordTimingSafe,
} from "../../_shared/auth.ts";
import {
  firstZodError,
  LoginRequestSchema,
  PasswordChangeRequestSchema,
  SignupRequestSchema,
  UserCreateSchema,
} from "../../_shared/validation.ts";
import { getCookie } from "hono/cookie";
import { getSettings } from "../../_shared/env.ts";

const USERNAME_TAKEN = "Username is already taken";
const INVALID_CREDENTIALS = "Invalid username or password";

export const authRouter = new Hono();

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: "manager" | "employee";
  farm_id: number;
  failed_login_attempts: number;
  locked_until: Date | null;
}

async function issueSession(
  c: import("hono").Context,
  user: AuthUser,
  farmName: string,
) {
  const raw = await issueRefreshToken(user.id);
  setRefreshCookie(c, raw);
  const token = await createAccessToken({
    sub: String(user.id),
    role: user.role,
    farm_id: user.farm_id,
  });
  return {
    access_token: token,
    token_type: "bearer",
    role: user.role,
    user_id: user.id,
    username: user.username,
    farm_id: user.farm_id,
    farm_name: farmName,
  };
}

authRouter.post("/login", rateLimit("login", 5, 60), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError(c, 422, firstZodError(parsed));

  const sql = getDb();
  const [user] = await sql<UserRow[]>`
    select id, username, password_hash, role, farm_id, failed_login_attempts, locked_until
    from users where username = ${parsed.data.username}
  `;

  const now = new Date();
  if (user && user.locked_until && new Date(user.locked_until) > now) {
    return jsonError(
      c,
      403,
      "Account temporarily locked due to failed logins. Try again later.",
    );
  }

  const passwordOk = await verifyPasswordTimingSafe(
    parsed.data.password,
    user ? user.password_hash : null,
  );

  if (!user || !passwordOk) {
    if (user) {
      const attempts = user.failed_login_attempts + 1;
      if (attempts >= getSettings().maxFailedLogins) {
        const lockedUntil = new Date(
          Date.now() + getSettings().lockoutMinutes * 60_000,
        );
        await sql`
          update users set failed_login_attempts = 0, locked_until = ${lockedUntil}
          where id = ${user.id}
        `;
        await recordAudit({
          c,
          actor: user as AuthUser,
          action: "account_locked",
          entityType: "user",
          entityId: user.id,
        });
      } else {
        await sql`update users set failed_login_attempts = ${attempts} where id = ${user.id}`;
      }
    }
    return jsonError(c, 401, INVALID_CREDENTIALS);
  }

  if (user.failed_login_attempts || user.locked_until) {
    await sql`
      update users set failed_login_attempts = 0, locked_until = null where id = ${user.id}
    `;
  }

  const [farm] = await sql<
    { name: string }[]
  >`select name from farms where id = ${user.farm_id}`;
  const token = await issueSession(c, user as AuthUser, farm.name);
  await recordAudit({
    c,
    actor: user as AuthUser,
    action: "login",
    entityType: "user",
    entityId: user.id,
  });
  return c.json(token);
});

authRouter.post("/signup", rateLimit("signup", 5, 60), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = SignupRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError(c, 422, firstZodError(parsed));

  const sql = getDb();
  const [existing] = await sql<{ id: number }[]>`
    select id from users where username = ${parsed.data.username}
  `;
  if (existing) return jsonError(c, 409, USERNAME_TAKEN);

  const farmName = parsed.data.farm_name || `${parsed.data.username}'s Farm`;
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const [{ user }] = await sql.begin(async (tx) => {
      const [farm] = await tx<
        { id: number }[]
      >`insert into farms (name) values (${farmName}) returning id`;
      const [newUser] = await tx<UserRow[]>`
        insert into users (username, password_hash, role, farm_id)
        values (${parsed.data.username}, ${passwordHash}, 'manager', ${farm.id})
        returning id, username, password_hash, role, farm_id, failed_login_attempts, locked_until
      `;
      return [{ user: newUser }];
    });
    const token = await issueSession(c, user as AuthUser, farmName);
    return c.json(token, 201);
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(c, 409, USERNAME_TAKEN);
    throw err;
  }
});

authRouter.post("/refresh", async (c) => {
  const raw = getCookie(c, getSettings().refreshCookieName);
  const user = raw ? await resolveRefreshToken(raw) : null;
  if (!user) {
    return jsonError(
      c,
      401,
      "Invalid or expired session. Please sign in again.",
    );
  }
  if (raw) await revokeRefreshToken(raw);
  const sql = getDb();
  const [farm] = await sql<
    { name: string }[]
  >`select name from farms where id = ${user.farm_id}`;
  const token = await issueSession(c, user, farm.name);
  return c.json(token);
});

authRouter.post("/logout", async (c) => {
  const raw = getCookie(c, getSettings().refreshCookieName);
  if (raw) await revokeRefreshToken(raw);
  clearRefreshCookie(c);
  return c.body(null, 204);
});

authRouter.put("/password", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = PasswordChangeRequestSchema.safeParse(body);
  if (!parsed.success) return jsonError(c, 422, firstZodError(parsed));

  const sql = getDb();
  const [row] = await sql<{ password_hash: string }[]>`
    select password_hash from users where id = ${user.id}
  `;
  if (
    !(await verifyPassword(parsed.data.current_password, row.password_hash))
  ) {
    return jsonError(c, 400, "Current password is incorrect");
  }
  const newHash = await hashPassword(parsed.data.new_password);
  await sql`update users set password_hash = ${newHash} where id = ${user.id}`;
  await revokeAllRefreshTokens(user.id);
  await recordAudit({
    c,
    actor: user,
    action: "password_change",
    entityType: "user",
    entityId: user.id,
  });
  return c.body(null, 204);
});

authRouter.post("/register", requireAuth, requireManager, async (c) => {
  const manager = c.get("user");
  const body = await c.req.json().catch(() => null);
  const parsed = UserCreateSchema.safeParse(body);
  if (!parsed.success) return jsonError(c, 422, firstZodError(parsed));

  const sql = getDb();
  const [existing] = await sql<{ id: number }[]>`
    select id from users where username = ${parsed.data.username}
  `;
  if (existing) return jsonError(c, 409, USERNAME_TAKEN);

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    const [newUser] = await sql<
      {
        id: number;
        username: string;
        role: string;
        farm_id: number;
        created_at: Date;
      }[]
    >`
      insert into users (username, password_hash, role, farm_id)
      values (${parsed.data.username}, ${passwordHash}, ${parsed.data.role}, ${manager.farm_id})
      returning id, username, role, farm_id, created_at
    `;
    await recordAudit({
      c,
      actor: manager,
      action: "create",
      entityType: "user",
      entityId: newUser.id,
      details: { username: newUser.username, role: newUser.role },
    });
    return c.json(newUser, 201);
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(c, 409, USERNAME_TAKEN);
    throw err;
  }
});
