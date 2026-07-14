// Port of backend/tests/test_users.py's core scenarios, run against the real
// Hono router (Hono's app.request() plays the role of FastAPI's TestClient)
// and a real local Postgres. authRouter is mounted alongside usersRouter so
// sessions can be created through the real signup/register flow rather than
// hand-rolled JWTs or DB rows.
import { assert, assertEquals } from "@std/assert";
import { Hono } from "hono";
import { authRouter } from "./auth.ts";
import { usersRouter } from "./users.ts";
import { getDb } from "../../_shared/db.ts";

const app = new Hono().route("/api/auth", authRouter).route(
  "/api/users",
  usersRouter,
);

function uniqueUsername(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

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
  const [remaining] = await sql<
    { id: number }[]
  >`select id from users where farm_id = ${user.farm_id}`;
  if (!remaining) {
    await sql`delete from audit_logs where farm_id = ${user.farm_id}`;
    await sql`delete from farms where id = ${user.farm_id}`;
  }
}

async function signupManager(ip: string, prefix: string) {
  const username = uniqueUsername(prefix);
  const res = await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  const body = await res.json();
  return {
    username,
    token: body.access_token as string,
    farmId: body.farm_id as number,
  };
}

async function registerEmployee(
  ip: string,
  managerToken: string,
  prefix: string,
) {
  const username = uniqueUsername(prefix);
  const res = await app.request("/api/auth/register", {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${managerToken}` }),
    body: JSON.stringify({ username, password: "GoodPass1", role: "employee" }),
  });
  const body = await res.json();
  return { username, id: body.id as number };
}

async function loginUser(ip: string, username: string, password = "GoodPass1") {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json();
  return body.access_token as string;
}

Deno.test("manager can list users in their farm", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "listmgr");
  const employee = await registerEmployee(ip, manager.token, "listemp");

  const res = await app.request("/api/users", {
    method: "GET",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  const usernames = body.map((u: { username: string }) => u.username);
  assert(usernames.includes(manager.username));
  assert(usernames.includes(employee.username));
  for (const u of body) {
    assertEquals("password_hash" in u, false);
  }

  await cleanupUser(employee.username);
  await cleanupUser(manager.username);
});

Deno.test("employee gets 403 listing users", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "empmgr");
  const employee = await registerEmployee(ip, manager.token, "emp403");
  const employeeToken = await loginUser(ip, employee.username);

  const res = await app.request("/api/users", {
    method: "GET",
    headers: testHeaders(ip, { Authorization: `Bearer ${employeeToken}` }),
  });
  assertEquals(res.status, 403);

  await cleanupUser(employee.username);
  await cleanupUser(manager.username);
});

Deno.test("manager can delete an employee", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "delmgr");
  const employee = await registerEmployee(ip, manager.token, "delemp");

  const res = await app.request(`/api/users/${employee.id}`, {
    method: "DELETE",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
  });
  assertEquals(res.status, 204);

  const sql = getDb();
  const [remaining] = await sql<
    { id: number }[]
  >`select id from users where id = ${employee.id}`;
  assertEquals(remaining, undefined);

  const [auditRow] = await sql<{ action: string; entity_id: number }[]>`
    select action, entity_id from audit_logs
    where action = 'delete' and entity_type = 'user' and entity_id = ${employee.id}
  `;
  assert(auditRow, "expected a delete audit log entry for the removed user");

  await cleanupUser(manager.username);
});

Deno.test("manager cannot delete their own account (400)", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "selfdel");

  const sql = getDb();
  const [self] = await sql<
    { id: number }[]
  >`select id from users where username = ${manager.username}`;

  const res = await app.request(`/api/users/${self.id}`, {
    method: "DELETE",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
  });
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.detail, "You cannot delete your own account");

  await cleanupUser(manager.username);
});

Deno.test("cross-tenant isolation: manager cannot delete a user in another farm (404)", async () => {
  const ip = crypto.randomUUID();
  const managerA = await signupManager(ip, "farmA");
  const managerB = await signupManager(ip, "farmB");
  const employeeB = await registerEmployee(ip, managerB.token, "farmBemp");

  const res = await app.request(`/api/users/${employeeB.id}`, {
    method: "DELETE",
    headers: testHeaders(ip, { Authorization: `Bearer ${managerA.token}` }),
  });
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body.detail, "User not found");

  // Confirm the user in farm B was untouched by the cross-tenant attempt.
  const sql = getDb();
  const [stillThere] = await sql<
    { id: number }[]
  >`select id from users where id = ${employeeB.id}`;
  assert(stillThere, "user in the other farm must not have been deleted");

  await cleanupUser(employeeB.username);
  await cleanupUser(managerB.username);
  await cleanupUser(managerA.username);
});

Deno.test("manager can delete an employee who has logged in (sessions cleared, no FK 500)", async () => {
  // Regression: refresh_tokens.user_id FK made any user who had ever logged
  // in undeletable — the delete surfaced a raw FK violation as a 500.
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "fkmgr");
  const employee = await registerEmployee(ip, manager.token, "fkemp");
  await loginUser(ip, employee.username); // issues a refresh token row

  const res = await app.request(`/api/users/${employee.id}`, {
    method: "DELETE",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
  });
  assertEquals(res.status, 204);

  const sql = getDb();
  const [tokenRow] = await sql<
    { id: number }[]
  >`select id from refresh_tokens where user_id = ${employee.id}`;
  assertEquals(tokenRow, undefined);

  await cleanupUser(manager.username);
});

Deno.test("deleting a user who recorded animals returns 409, not 500, and keeps the records", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "histmgr");
  const employee = await registerEmployee(ip, manager.token, "histemp");

  const sql = getDb();
  const [self] = await sql<
    { id: number; farm_id: number }[]
  >`select id, farm_id from users where username = ${manager.username}`;
  const [animal] = await sql<{ id: number }[]>`
    insert into animals (farm_id, name, animal_type, status, added_by_user_id)
    values (${self.farm_id}, 'HistoryCow', 'cattle', 'alive', ${employee.id})
    returning id
  `;

  const res = await app.request(`/api/users/${employee.id}`, {
    method: "DELETE",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
  });
  assertEquals(res.status, 409);

  // Neither the user nor their recorded animal was touched.
  const [stillThere] = await sql<
    { id: number }[]
  >`select id from users where id = ${employee.id}`;
  assert(stillThere, "user with history must not have been deleted");
  const [animalStillThere] = await sql<
    { id: number }[]
  >`select id from animals where id = ${animal.id}`;
  assert(animalStillThere, "recorded animal must not have been deleted");

  await sql`delete from animals where id = ${animal.id}`;
  await cleanupUser(employee.username);
  await cleanupUser(manager.username);
});

Deno.test("deleting a nonexistent user returns 404", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "notfound");

  const res = await app.request("/api/users/999999999", {
    method: "DELETE",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
  });
  assertEquals(res.status, 404);

  await cleanupUser(manager.username);
});
