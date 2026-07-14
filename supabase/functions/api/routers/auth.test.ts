// Port of backend/tests/test_auth.py's core scenarios, run against the real
// Hono router (Hono's app.request() plays the role of FastAPI's TestClient)
// and a real local Postgres.
import { assert, assertEquals } from "@std/assert";
import { Hono } from "hono";
import { authRouter } from "./auth.ts";
import { getDb } from "../../_shared/db.ts";

const app = new Hono().route("/api/auth", authRouter);

function uniqueUsername(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

// Rate limiting is per-client-IP (see _shared/rateLimit.ts). Without this,
// every test in this file would share the same "unknown" IP bucket and
// starve each other out within the 60s window — give each test its own
// fake IP so tests are isolated the way distinct real clients would be.
function testHeaders(ip: string, extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    "x-forwarded-for": ip,
    ...extra,
  };
}

async function cleanupUser(username: string) {
  const sql = getDb();
  const [user] = await sql<{ id: number; farm_id: number }[]>`
    select id, farm_id from users where username = ${username}
  `;
  if (!user) return;
  await sql`delete from refresh_tokens where user_id = ${user.id}`;
  await sql`delete from audit_logs where actor_user_id = ${user.id}`;
  await sql`delete from users where id = ${user.id}`;
  // Only remove the farm once no other user (e.g. a registered employee
  // sharing the manager's farm) still references it.
  const [remaining] = await sql<
    { id: number }[]
  >`select id from users where farm_id = ${user.farm_id}`;
  if (!remaining) {
    await sql`delete from audit_logs where farm_id = ${user.farm_id}`;
    await sql`delete from farms where id = ${user.farm_id}`;
  }
}

Deno.test("signup creates a farm + manager and returns a session", async () => {
  const ip = crypto.randomUUID();
  const username = uniqueUsername("signup");
  const res = await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({
      username,
      password: "GoodPass1",
      farm_name: "Test Farm",
    }),
  });
  assertEquals(res.status, 201);
  const body = await res.json();
  assertEquals(body.role, "manager");
  assertEquals(body.farm_name, "Test Farm");
  assert(body.access_token);
  await cleanupUser(username);
});

Deno.test("signup with taken username returns 409", async () => {
  const ip = crypto.randomUUID();
  const username = uniqueUsername("dup");
  await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  const res = await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  assertEquals(res.status, 409);
  await cleanupUser(username);
});

Deno.test("login with wrong password fails, correct password succeeds", async () => {
  const ip = crypto.randomUUID();
  const username = uniqueUsername("login");
  await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });

  const bad = await app.request("/api/auth/login", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "WrongPass1" }),
  });
  assertEquals(bad.status, 401);

  const good = await app.request("/api/auth/login", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  assertEquals(good.status, 200);
  await cleanupUser(username);
});

Deno.test("login for nonexistent user returns 401 (not 404 — no user enumeration)", async () => {
  const ip = crypto.randomUUID();
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({
      username: "definitely_not_a_real_user",
      password: "whatever1A",
    }),
  });
  assertEquals(res.status, 401);
});

Deno.test("account locks after max failed logins, then rejects even correct password", async () => {
  const ip = crypto.randomUUID();
  const username = uniqueUsername("lockout");
  await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });

  // Note: this exercises the DB lockout counter, not the IP rate limiter —
  // login itself is also rate-limited at 5/min, so the 6th call below would
  // 429 before reaching the lockout check if it were on the SAME ip as the 5
  // failed attempts. Use a second "trusted" ip for the final check, mirroring
  // a legitimate user retrying from a different network after the lock.
  for (let i = 0; i < 5; i++) {
    await app.request("/api/auth/login", {
      method: "POST",
      headers: testHeaders(ip),
      body: JSON.stringify({ username, password: "WrongPass1" }),
    });
  }

  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: testHeaders(crypto.randomUUID()),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  assertEquals(res.status, 403);
  await cleanupUser(username);
});

Deno.test("refresh rotates the token; old cookie becomes invalid", async () => {
  const ip = crypto.randomUUID();
  const username = uniqueUsername("refresh");
  const signupRes = await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  const setCookie = signupRes.headers.get("set-cookie")!;
  const cookieValue = setCookie.split(";")[0];

  const refreshRes = await app.request("/api/auth/refresh", {
    method: "POST",
    headers: { Cookie: cookieValue },
  });
  assertEquals(refreshRes.status, 200);
  const newSetCookie = refreshRes.headers.get("set-cookie")!;
  const newCookieValue = newSetCookie.split(";")[0];
  assert(
    newCookieValue !== cookieValue,
    "refresh must rotate to a new cookie value",
  );

  // Old refresh cookie must now be rejected (rotation revokes it).
  const reuseOld = await app.request("/api/auth/refresh", {
    method: "POST",
    headers: { Cookie: cookieValue },
  });
  assertEquals(reuseOld.status, 401);

  await cleanupUser(username);
});

Deno.test("manager can register an employee in their own farm; employee cannot register", async () => {
  const ip = crypto.randomUUID();
  const managerUsername = uniqueUsername("mgr");
  const signupRes = await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username: managerUsername, password: "GoodPass1" }),
  });
  const { access_token } = await signupRes.json();

  const employeeUsername = uniqueUsername("emp");
  const registerRes = await app.request("/api/auth/register", {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${access_token}` }),
    body: JSON.stringify({
      username: employeeUsername,
      password: "GoodPass1",
      role: "employee",
    }),
  });
  assertEquals(registerRes.status, 201);

  const employeeLogin = await app.request("/api/auth/login", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username: employeeUsername, password: "GoodPass1" }),
  });
  const { access_token: employeeToken } = await employeeLogin.json();

  const forbidden = await app.request("/api/auth/register", {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${employeeToken}` }),
    body: JSON.stringify({
      username: uniqueUsername("emp2"),
      password: "GoodPass1",
      role: "employee",
    }),
  });
  assertEquals(forbidden.status, 403);

  await cleanupUser(employeeUsername);
  await cleanupUser(managerUsername);
});

Deno.test("password change revokes all sessions and requires correct current password", async () => {
  const ip = crypto.randomUUID();
  const username = uniqueUsername("pwchange");
  const signupRes = await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  const { access_token } = await signupRes.json();

  const wrongCurrent = await app.request("/api/auth/password", {
    method: "PUT",
    headers: testHeaders(ip, { Authorization: `Bearer ${access_token}` }),
    body: JSON.stringify({
      current_password: "WrongPass1",
      new_password: "NewPass1x",
    }),
  });
  assertEquals(wrongCurrent.status, 400);

  const ok = await app.request("/api/auth/password", {
    method: "PUT",
    headers: testHeaders(ip, { Authorization: `Bearer ${access_token}` }),
    body: JSON.stringify({
      current_password: "GoodPass1",
      new_password: "NewPass1x",
    }),
  });
  assertEquals(ok.status, 204);

  const oldPasswordLogin = await app.request("/api/auth/login", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  assertEquals(oldPasswordLogin.status, 401);

  const newPasswordLogin = await app.request("/api/auth/login", {
    method: "POST",
    headers: testHeaders(crypto.randomUUID()),
    body: JSON.stringify({ username, password: "NewPass1x" }),
  });
  assertEquals(newPasswordLogin.status, 200);

  await cleanupUser(username);
});
