// Port of backend/tests/test_audit.py's core scenarios, run against the real
// Hono router (Hono's app.request() plays the role of FastAPI's TestClient)
// and a real local Postgres. authRouter is mounted alongside so we can create
// real authenticated sessions via /api/auth/signup, matching auth.test.ts.
import { assert, assertEquals } from "@std/assert";
import { Hono } from "hono";
import { auditRouter } from "./audit.ts";
import { authRouter } from "./auth.ts";
import { getDb } from "../../_shared/db.ts";

const app = new Hono().route("/api/auth", authRouter).route(
  "/api/audit",
  auditRouter,
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

async function signup(
  username: string,
  ip: string,
): Promise<{ access_token: string; farm_id: number; user_id: number }> {
  const res = await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  return await res.json();
}

async function seedAuditRow(
  farmId: number,
  actorUserId: number,
  actorUsername: string,
  action: string,
  details: Record<string, unknown> | null = null,
): Promise<void> {
  const sql = getDb();
  await sql`
    insert into audit_logs (farm_id, actor_user_id, actor_username, action, entity_type, entity_id, details, ip)
    values (${farmId}, ${actorUserId}, ${actorUsername}, ${action}, 'animal', 1, ${
    details ? JSON.stringify(details) : null
  }, '203.0.113.5')
  `;
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

Deno.test("manager can list audit logs for their farm, most recent first", async () => {
  const ip = crypto.randomUUID();
  const username = uniqueUsername("audmgr");
  const session = await signup(username, ip);
  // signup itself doesn't write an audit row (no farm context yet at the
  // time it runs in this port); seed rows directly to control ordering.
  await seedAuditRow(session.farm_id, session.user_id, username, "create", {
    name: "Bessie",
  });
  await new Promise((r) => setTimeout(r, 5));
  await seedAuditRow(session.farm_id, session.user_id, username, "update", {
    name: "Bessie",
  });

  const res = await app.request("/api/audit", {
    method: "GET",
    headers: testHeaders(ip, {
      Authorization: `Bearer ${session.access_token}`,
    }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assert(body.items.length >= 2);
  assertEquals(body.items[0].action, "update");
  assertEquals(body.items[1].action, "create");
  assertEquals(body.page, 1);
  assertEquals(body.limit, 50);
  assert(body.total >= 2);

  const first = body.items[0];
  assertEquals(first.actor_username, username);
  assertEquals(first.entity_type, "animal");
  assertEquals(first.entity_id, 1);
  assertEquals(first.ip, "203.0.113.5");
  assert(first.created_at);
  assertEquals(typeof first.id, "number");

  await cleanupUser(username);
});

Deno.test("employee gets 403", async () => {
  const ip = crypto.randomUUID();
  const managerUsername = uniqueUsername("audmgr2");
  const session = await signup(managerUsername, ip);

  const employeeUsername = uniqueUsername("audemp");
  const registerRes = await app.request("/api/auth/register", {
    method: "POST",
    headers: testHeaders(ip, {
      Authorization: `Bearer ${session.access_token}`,
    }),
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

  const res = await app.request("/api/audit", {
    method: "GET",
    headers: testHeaders(ip, { Authorization: `Bearer ${employeeToken}` }),
  });
  assertEquals(res.status, 403);

  await cleanupUser(employeeUsername);
  await cleanupUser(managerUsername);
});

Deno.test("unauthenticated request is rejected", async () => {
  const res = await app.request("/api/audit", { method: "GET" });
  assertEquals(res.status, 401);
});

Deno.test("pagination works: page/limit slice results and respect bounds", async () => {
  const ip = crypto.randomUUID();
  const username = uniqueUsername("audpage");
  const session = await signup(username, ip);

  for (let i = 0; i < 5; i++) {
    await seedAuditRow(
      session.farm_id,
      session.user_id,
      username,
      `action_${i}`,
    );
    await new Promise((r) => setTimeout(r, 2));
  }

  const page1 = await app.request("/api/audit?page=1&limit=2", {
    method: "GET",
    headers: testHeaders(ip, {
      Authorization: `Bearer ${session.access_token}`,
    }),
  });
  assertEquals(page1.status, 200);
  const body1 = await page1.json();
  assertEquals(body1.items.length, 2);
  assertEquals(body1.page, 1);
  assertEquals(body1.limit, 2);
  assertEquals(body1.total, 5);

  const page2 = await app.request("/api/audit?page=2&limit=2", {
    method: "GET",
    headers: testHeaders(ip, {
      Authorization: `Bearer ${session.access_token}`,
    }),
  });
  const body2 = await page2.json();
  assertEquals(body2.items.length, 2);
  assert(body1.items[0].id !== body2.items[0].id);

  // Out-of-range limit -> 422 (mirrors FastAPI's Query(50, ge=1, le=200)).
  const badLimit = await app.request("/api/audit?limit=500", {
    method: "GET",
    headers: testHeaders(ip, {
      Authorization: `Bearer ${session.access_token}`,
    }),
  });
  assertEquals(badLimit.status, 422);

  const badPage = await app.request("/api/audit?page=0", {
    method: "GET",
    headers: testHeaders(ip, {
      Authorization: `Bearer ${session.access_token}`,
    }),
  });
  assertEquals(badPage.status, 422);

  await cleanupUser(username);
});

Deno.test("farm isolation: manager cannot see another farm's audit trail", async () => {
  const ipA = crypto.randomUUID();
  const ipB = crypto.randomUUID();
  const usernameA = uniqueUsername("audfarmA");
  const usernameB = uniqueUsername("audfarmB");

  const sessionA = await signup(usernameA, ipA);
  const sessionB = await signup(usernameB, ipB);

  await seedAuditRow(
    sessionA.farm_id,
    sessionA.user_id,
    usernameA,
    "farm_a_only_action",
  );
  await seedAuditRow(
    sessionB.farm_id,
    sessionB.user_id,
    usernameB,
    "farm_b_only_action",
  );

  const resA = await app.request("/api/audit", {
    method: "GET",
    headers: testHeaders(ipA, {
      Authorization: `Bearer ${sessionA.access_token}`,
    }),
  });
  const bodyA = await resA.json();
  const actionsA = bodyA.items.map((i: { action: string }) => i.action);
  assert(actionsA.includes("farm_a_only_action"));
  assert(!actionsA.includes("farm_b_only_action"));

  const resB = await app.request("/api/audit", {
    method: "GET",
    headers: testHeaders(ipB, {
      Authorization: `Bearer ${sessionB.access_token}`,
    }),
  });
  const bodyB = await resB.json();
  const actionsB = bodyB.items.map((i: { action: string }) => i.action);
  assert(actionsB.includes("farm_b_only_action"));
  assert(!actionsB.includes("farm_a_only_action"));

  await cleanupUser(usernameA);
  await cleanupUser(usernameB);
});

Deno.test("jsonb details column round-trips as a JS object", async () => {
  const ip = crypto.randomUUID();
  const username = uniqueUsername("audjsonb");
  const session = await signup(username, ip);

  const details = {
    name: "Bessie",
    role: "employee",
    nested: { count: 3, active: true },
  };
  await seedAuditRow(
    session.farm_id,
    session.user_id,
    username,
    "create",
    details,
  );

  const res = await app.request("/api/audit", {
    method: "GET",
    headers: testHeaders(ip, {
      Authorization: `Bearer ${session.access_token}`,
    }),
  });
  const body = await res.json();
  const row = body.items.find((i: { action: string }) => i.action === "create");
  assert(row);
  assertEquals(typeof row.details, "object");
  assertEquals(row.details.name, "Bessie");
  assertEquals(row.details.nested.count, 3);
  assertEquals(row.details.nested.active, true);

  await cleanupUser(username);
});

Deno.test("audit row with null actor/details/ip serializes as null, not omitted", async () => {
  const ip = crypto.randomUUID();
  const username = uniqueUsername("audnull");
  const session = await signup(username, ip);

  const sql = getDb();
  await sql`
    insert into audit_logs (farm_id, actor_user_id, actor_username, action, entity_type, entity_id, details, ip)
    values (${session.farm_id}, null, null, 'system_event', 'system', null, null, null)
  `;

  const res = await app.request("/api/audit", {
    method: "GET",
    headers: testHeaders(ip, {
      Authorization: `Bearer ${session.access_token}`,
    }),
  });
  const body = await res.json();
  const row = body.items.find((i: { action: string }) =>
    i.action === "system_event"
  );
  assert(row);
  assertEquals(row.actor_user_id, null);
  assertEquals(row.actor_username, null);
  assertEquals(row.entity_id, null);
  assertEquals(row.details, null);
  assertEquals(row.ip, null);

  await cleanupUser(username);
});
