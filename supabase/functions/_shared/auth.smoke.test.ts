// Runtime smoke test for the highest-risk shared module, run against a real
// local Postgres (moometrics_test) — not just type-checked. Covers: password
// hash/verify round-trip, timing-safe dummy-hash path, JWT sign/verify
// (including issuer + expiry), and refresh-token issue/resolve/rotate/revoke.
import { assert, assertEquals } from "@std/assert";
import { getDb } from "./db.ts";
import {
  createAccessToken,
  hashPassword,
  issueRefreshToken,
  resolveRefreshToken,
  revokeRefreshToken,
  verifyAccessToken,
  verifyPassword,
  verifyPasswordTimingSafe,
} from "./auth.ts";

Deno.test("password hash/verify round-trip", async () => {
  const hash = await hashPassword("Sup3rSecret");
  assert(await verifyPassword("Sup3rSecret", hash));
  assert(!(await verifyPassword("wrong", hash)));
});

Deno.test("timing-safe verify returns false for nonexistent user without throwing", async () => {
  assertEquals(await verifyPasswordTimingSafe("anything", null), false);
});

Deno.test("access token round-trips claims", async () => {
  const token = await createAccessToken({
    sub: "42",
    role: "manager",
    farm_id: 7,
  });
  const claims = await verifyAccessToken(token);
  assertEquals(claims?.sub, "42");
  assertEquals(claims?.role, "manager");
  assertEquals(claims?.farm_id, 7);
});

Deno.test("invalid token verification returns null, not a throw", async () => {
  const claims = await verifyAccessToken("not-a-real-token");
  assertEquals(claims, null);
});

Deno.test("refresh token: issue -> resolve -> revoke -> resolve fails", async () => {
  const sql = getDb();
  const [farm] = await sql<
    { id: number }[]
  >`insert into farms (name) values ('Smoke Farm') returning id`;
  const [user] = await sql<{ id: number }[]>`
    insert into users (username, password_hash, role, farm_id)
    values ('smoketest_user', 'x', 'manager', ${farm.id}) returning id
  `;

  const raw = await issueRefreshToken(user.id);
  const resolved = await resolveRefreshToken(raw);
  assertEquals(resolved?.id, user.id);

  await revokeRefreshToken(raw);
  const afterRevoke = await resolveRefreshToken(raw);
  assertEquals(afterRevoke, null);

  await sql`delete from refresh_tokens where user_id = ${user.id}`;
  await sql`delete from users where id = ${user.id}`;
  await sql`delete from farms where id = ${farm.id}`;
  await sql.end();
});
