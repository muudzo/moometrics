// Port of backend/app/services/auth_service.py + the cookie/session helpers
// from backend/app/routers/auth.py. This is the highest-risk file in the
// rewrite — it must preserve: timing-safe login (dummy-hash comparison for
// nonexistent users), refresh-token rotation, and the exact cookie contract.
import { errors as joseErrors, jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { deleteCookie, setCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import { getDb } from "./db.ts";
import { getSettings } from "./env.ts";
import { jsonError } from "./response.ts";

export interface AuthUser {
  id: number;
  username: string;
  role: "manager" | "employee";
  farm_id: number;
}

// --- Password hashing -------------------------------------------------

export async function hashPassword(plain: string): Promise<string> {
  return await bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hashed: string,
): Promise<boolean> {
  return await bcrypt.compare(plain, hashed);
}

let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  if (dummyHash) return dummyHash;
  const computed = await bcrypt.hash(
    "timing-attack-mitigation-placeholder",
    12,
  );
  dummyHash = computed;
  return computed;
}

/** Always does bcrypt work, even for a nonexistent user, so login response
 * time doesn't reveal whether the username exists. */
export async function verifyPasswordTimingSafe(
  plain: string,
  hashed: string | null,
): Promise<boolean> {
  if (hashed === null) {
    await bcrypt.compare(plain, await getDummyHash());
    return false;
  }
  return await bcrypt.compare(plain, hashed);
}

// --- Access tokens (JWT) ----------------------------------------------

export async function createAccessToken(
  claims: { sub: string; role: string; farm_id: number },
): Promise<string> {
  const settings = getSettings();
  const secret = new TextEncoder().encode(settings.jwtSecret);
  return await new SignJWT({ role: claims.role, farm_id: claims.farm_id })
    .setProtectedHeader({ alg: settings.jwtAlgorithm })
    .setSubject(claims.sub)
    .setIssuer(settings.jwtIssuer)
    .setExpirationTime(`${settings.accessTokenExpireMinutes}m`)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
): Promise<{ sub: string; role: string; farm_id: number } | null> {
  const settings = getSettings();
  const secret = new TextEncoder().encode(settings.jwtSecret);
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: settings.jwtIssuer,
      // Mirrors python-jose's options={"verify_aud": False} — audience is
      // intentionally not checked.
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      role: payload.role as string,
      farm_id: payload.farm_id as number,
    };
  } catch (err) {
    if (err instanceof joseErrors.JOSEError) return null;
    throw err;
  }
}

// --- Refresh tokens ------------------------------------------------------

async function hashToken(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomUrlSafeToken(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function issueRefreshToken(userId: number): Promise<string> {
  const settings = getSettings();
  const sql = getDb();
  const raw = randomUrlSafeToken(48);
  const expiresAt = new Date(
    Date.now() + settings.refreshTokenExpireDays * 86400 * 1000,
  );
  await sql`
    insert into refresh_tokens (user_id, token_hash, expires_at, revoked)
    values (${userId}, ${await hashToken(raw)}, ${expiresAt}, false)
  `;
  return raw;
}

export async function resolveRefreshToken(
  raw: string,
): Promise<AuthUser | null> {
  const sql = getDb();
  const tokenHash = await hashToken(raw);
  const [record] = await sql<
    { user_id: number; revoked: boolean; expires_at: Date }[]
  >`
    select user_id, revoked, expires_at from refresh_tokens
    where token_hash = ${tokenHash}
  `;
  if (!record || record.revoked) return null;
  if (new Date(record.expires_at) < new Date()) return null;
  const [user] = await sql<AuthUser[]>`
    select id, username, role, farm_id from users where id = ${record.user_id}
  `;
  return user ?? null;
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  const sql = getDb();
  const tokenHash = await hashToken(raw);
  await sql`update refresh_tokens set revoked = true where token_hash = ${tokenHash}`;
}

export async function revokeAllRefreshTokens(userId: number): Promise<void> {
  const sql = getDb();
  await sql`
    update refresh_tokens set revoked = true
    where user_id = ${userId} and revoked = false
  `;
}

// --- Cookie helpers (must match backend/app/routers/auth.py exactly) -----

export function setRefreshCookie(c: Context, raw: string): void {
  const settings = getSettings();
  setCookie(c, settings.refreshCookieName, raw, {
    httpOnly: true,
    secure: settings.isProduction,
    sameSite: settings.isProduction ? "None" : "Lax",
    maxAge: settings.refreshTokenExpireDays * 86400,
    path: "/api/auth",
  });
}

export function clearRefreshCookie(c: Context): void {
  const settings = getSettings();
  deleteCookie(c, settings.refreshCookieName, { path: "/api/auth" });
}

// --- Hono middleware -----------------------------------------------------

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!token) {
    return jsonError(c, 401, "Could not validate credentials");
  }
  const claims = await verifyAccessToken(token);
  if (!claims) {
    return jsonError(c, 401, "Could not validate credentials");
  }
  const sql = getDb();
  const [user] = await sql<AuthUser[]>`
    select id, username, role, farm_id from users where id = ${
    parseInt(claims.sub, 10)
  }
  `;
  if (!user) {
    return jsonError(c, 401, "Could not validate credentials");
  }
  c.set("user", user);
  await next();
};

export const requireManager: MiddlewareHandler = async (c, next) => {
  const user = c.get("user");
  if (user.role !== "manager") {
    return jsonError(c, 403, "Manager access required");
  }
  await next();
};
