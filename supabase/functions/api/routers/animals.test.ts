// Port of backend/tests/test_animals.py's core scenarios, run against the real
// Hono routers (Hono's app.request() plays the role of FastAPI's TestClient)
// and a real local Postgres. Sessions are obtained through the real authRouter
// (signup/login/register) so these tests exercise the real auth middleware,
// not a bypass.
import { assert, assertEquals } from "@std/assert";
import { Hono } from "hono";
import { authRouter } from "./auth.ts";
import { animalsRouter } from "./animals.ts";
import { getDb } from "../../_shared/db.ts";

const app = new Hono().route("/api/auth", authRouter).route(
  "/api/animals",
  animalsRouter,
);

function uniqueUsername(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function uniqueTag(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

// Rate limiting is per-client-IP (see _shared/rateLimit.ts) and applies to
// /api/auth/signup and /api/auth/login (5/min each), not to the animals
// routes. Give each test its own fake IP so signup/login calls across tests
// never share a bucket.
function testHeaders(ip: string, extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    "x-forwarded-for": ip,
    ...extra,
  };
}

interface Session {
  farmId: number;
  token: string;
  username: string;
}

async function signupManager(ip: string, prefix = "mgr"): Promise<Session> {
  const username = uniqueUsername(prefix);
  const res = await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  assertEquals(res.status, 201);
  const body = await res.json();
  return { farmId: body.farm_id, token: body.access_token, username };
}

async function registerEmployee(
  ip: string,
  managerToken: string,
): Promise<Session> {
  const username = uniqueUsername("emp");
  const registerRes = await app.request("/api/auth/register", {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${managerToken}` }),
    body: JSON.stringify({ username, password: "GoodPass1", role: "employee" }),
  });
  assertEquals(registerRes.status, 201);
  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  assertEquals(loginRes.status, 200);
  const body = await loginRes.json();
  return { farmId: body.farm_id, token: body.access_token, username };
}

async function cleanupFarm(farmId: number) {
  const sql = getDb();
  await sql`delete from animals where farm_id = ${farmId}`;
  const users = await sql<
    { id: number }[]
  >`select id from users where farm_id = ${farmId}`;
  for (const u of users) {
    await sql`delete from refresh_tokens where user_id = ${u.id}`;
  }
  await sql`delete from audit_logs where farm_id = ${farmId}`;
  await sql`delete from users where farm_id = ${farmId}`;
  await sql`delete from farms where id = ${farmId}`;
}

function authHeaders(session: Session) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.token}`,
  };
}

Deno.test("create animal succeeds and shows up in the list, most recent first", async () => {
  const ip = crypto.randomUUID();
  const mgr = await signupManager(ip);

  const createRes = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgr),
    body: JSON.stringify({
      name: "Bessie",
      animal_type: "cattle",
      breed: "Holstein",
    }),
  });
  assertEquals(createRes.status, 201);
  const created = await createRes.json();
  assertEquals(created.name, "Bessie");
  assertEquals(created.status, "alive");
  assertEquals(created.farm_id, mgr.farmId);
  assertEquals(created.added_by_user_id, created.added_by_user_id);
  assert(created.id);

  const listRes = await app.request("/api/animals", {
    headers: authHeaders(mgr),
  });
  assertEquals(listRes.status, 200);
  const page = await listRes.json();
  assertEquals(page.total, 1);
  assertEquals(page.page, 1);
  assertEquals(page.limit, 50);
  assertEquals(page.items.length, 1);
  assertEquals(page.items[0].id, created.id);

  await cleanupFarm(mgr.farmId);
});

Deno.test("get single animal returns the record; unknown id returns 404", async () => {
  const ip = crypto.randomUUID();
  const mgr = await signupManager(ip);

  const createRes = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgr),
    body: JSON.stringify({ name: "Dolly", animal_type: "sheep" }),
  });
  const created = await createRes.json();

  const getRes = await app.request(`/api/animals/${created.id}`, {
    headers: authHeaders(mgr),
  });
  assertEquals(getRes.status, 200);
  const fetched = await getRes.json();
  assertEquals(fetched.id, created.id);
  assertEquals(fetched.name, "Dolly");

  const missingRes = await app.request("/api/animals/999999999", {
    headers: authHeaders(mgr),
  });
  assertEquals(missingRes.status, 404);

  await cleanupFarm(mgr.farmId);
});

Deno.test("update animal applies only the fields present in the body", async () => {
  const ip = crypto.randomUUID();
  const mgr = await signupManager(ip);

  const createRes = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgr),
    body: JSON.stringify({
      name: "Porky",
      animal_type: "pig",
      breed: "Yorkshire",
    }),
  });
  const created = await createRes.json();

  const updateRes = await app.request(`/api/animals/${created.id}`, {
    method: "PUT",
    headers: authHeaders(mgr),
    body: JSON.stringify({ name: "Porky II" }),
  });
  assertEquals(updateRes.status, 200);
  const updated = await updateRes.json();
  assertEquals(updated.name, "Porky II");
  // breed was not present in the PUT body, so it must be left untouched.
  assertEquals(updated.breed, "Yorkshire");

  await cleanupFarm(mgr.farmId);
});

Deno.test("delete animal removes it; subsequent get returns 404", async () => {
  const ip = crypto.randomUUID();
  const mgr = await signupManager(ip);

  const createRes = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgr),
    body: JSON.stringify({ name: "Henrietta", animal_type: "chicken" }),
  });
  const created = await createRes.json();

  const deleteRes = await app.request(`/api/animals/${created.id}`, {
    method: "DELETE",
    headers: authHeaders(mgr),
  });
  assertEquals(deleteRes.status, 204);

  const getRes = await app.request(`/api/animals/${created.id}`, {
    headers: authHeaders(mgr),
  });
  assertEquals(getRes.status, 404);

  await cleanupFarm(mgr.farmId);
});

Deno.test("duplicate tag_number within the same farm returns 409 on create and update", async () => {
  const ip = crypto.randomUUID();
  const mgr = await signupManager(ip);
  const tag = uniqueTag("TAG");

  const firstRes = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgr),
    body: JSON.stringify({
      name: "Angus",
      animal_type: "cattle",
      tag_number: tag,
    }),
  });
  assertEquals(firstRes.status, 201);

  const dupRes = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgr),
    body: JSON.stringify({
      name: "Angus II",
      animal_type: "cattle",
      tag_number: tag,
    }),
  });
  assertEquals(dupRes.status, 409);

  const secondRes = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgr),
    body: JSON.stringify({ name: "Highland", animal_type: "cattle" }),
  });
  const second = await secondRes.json();

  const clashUpdateRes = await app.request(`/api/animals/${second.id}`, {
    method: "PUT",
    headers: authHeaders(mgr),
    body: JSON.stringify({ tag_number: tag }),
  });
  assertEquals(clashUpdateRes.status, 409);

  await cleanupFarm(mgr.farmId);
});

Deno.test("a different farm may reuse the same tag_number (uniqueness is per-farm)", async () => {
  const ip = crypto.randomUUID();
  const mgrA = await signupManager(ip, "farmA");
  const mgrB = await signupManager(ip, "farmB");
  const tag = uniqueTag("SHARED");

  const resA = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgrA),
    body: JSON.stringify({
      name: "A-cow",
      animal_type: "cattle",
      tag_number: tag,
    }),
  });
  assertEquals(resA.status, 201);

  const resB = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgrB),
    body: JSON.stringify({
      name: "B-cow",
      animal_type: "cattle",
      tag_number: tag,
    }),
  });
  assertEquals(resB.status, 201);

  await cleanupFarm(mgrA.farmId);
  await cleanupFarm(mgrB.farmId);
});

Deno.test("cross-tenant isolation: farm B cannot see, update, or delete farm A's animal (404)", async () => {
  const ip = crypto.randomUUID();
  const mgrA = await signupManager(ip, "farmA");
  const mgrB = await signupManager(ip, "farmB");

  const createRes = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgrA),
    body: JSON.stringify({ name: "Secret", animal_type: "goat" }),
  });
  const animal = await createRes.json();

  const getRes = await app.request(`/api/animals/${animal.id}`, {
    headers: authHeaders(mgrB),
  });
  assertEquals(getRes.status, 404);

  const updateRes = await app.request(`/api/animals/${animal.id}`, {
    method: "PUT",
    headers: authHeaders(mgrB),
    body: JSON.stringify({ name: "Hijacked" }),
  });
  assertEquals(updateRes.status, 404);

  const deleteRes = await app.request(`/api/animals/${animal.id}`, {
    method: "DELETE",
    headers: authHeaders(mgrB),
  });
  assertEquals(deleteRes.status, 404);

  // The animal must be untouched from farm A's perspective.
  const stillThereRes = await app.request(`/api/animals/${animal.id}`, {
    headers: authHeaders(mgrA),
  });
  assertEquals(stillThereRes.status, 200);
  const stillThere = await stillThereRes.json();
  assertEquals(stillThere.name, "Secret");

  await cleanupFarm(mgrA.farmId);
  await cleanupFarm(mgrB.farmId);
});

Deno.test("employee cannot delete an animal (403); manager can", async () => {
  const ip = crypto.randomUUID();
  const mgr = await signupManager(ip);
  const emp = await registerEmployee(ip, mgr.token);

  const createRes = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgr),
    body: JSON.stringify({ name: "Buttercup", animal_type: "cattle" }),
  });
  const animal = await createRes.json();

  const forbiddenRes = await app.request(`/api/animals/${animal.id}`, {
    method: "DELETE",
    headers: authHeaders(emp),
  });
  assertEquals(forbiddenRes.status, 403);

  const allowedRes = await app.request(`/api/animals/${animal.id}`, {
    method: "DELETE",
    headers: authHeaders(mgr),
  });
  assertEquals(allowedRes.status, 204);

  await cleanupFarm(mgr.farmId);
});

Deno.test("employee can create and update animals but cannot set status to dead via PUT", async () => {
  const ip = crypto.randomUUID();
  const mgr = await signupManager(ip);
  const emp = await registerEmployee(ip, mgr.token);

  const createRes = await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(emp),
    body: JSON.stringify({ name: "Employee-added", animal_type: "horse" }),
  });
  assertEquals(createRes.status, 201);
  const animal = await createRes.json();

  const forbiddenRes = await app.request(`/api/animals/${animal.id}`, {
    method: "PUT",
    headers: authHeaders(emp),
    body: JSON.stringify({ status: "dead" }),
  });
  assertEquals(forbiddenRes.status, 403);

  // A non-status field update by the employee should still succeed.
  const okRes = await app.request(`/api/animals/${animal.id}`, {
    method: "PUT",
    headers: authHeaders(emp),
    body: JSON.stringify({ notes: "checked in" }),
  });
  assertEquals(okRes.status, 200);

  const managerRes = await app.request(`/api/animals/${animal.id}`, {
    method: "PUT",
    headers: authHeaders(mgr),
    body: JSON.stringify({ status: "dead" }),
  });
  assertEquals(managerRes.status, 200);
  const dead = await managerRes.json();
  assertEquals(dead.status, "dead");

  await cleanupFarm(mgr.farmId);
});

Deno.test("export.csv returns a CSV with the expected header and rows", async () => {
  const ip = crypto.randomUUID();
  const mgr = await signupManager(ip);

  await app.request("/api/animals", {
    method: "POST",
    headers: authHeaders(mgr),
    body: JSON.stringify({
      name: "Csv-cow",
      animal_type: "cattle",
      tag_number: uniqueTag("CSV"),
    }),
  });

  const csvRes = await app.request("/api/animals/export.csv", {
    headers: authHeaders(mgr),
  });
  assertEquals(csvRes.status, 200);
  assertEquals(csvRes.headers.get("content-type"), "text/csv");
  const text = await csvRes.text();
  const lines = text.trim().split("\r\n");
  assertEquals(
    lines[0],
    "id,name,animal_type,tag_number,breed,date_of_birth,status,notes,created_at",
  );
  assertEquals(lines.length, 2);
  assert(lines[1].includes("Csv-cow"));

  await cleanupFarm(mgr.farmId);
});

Deno.test("list pagination: page and limit are honored and validated", async () => {
  const ip = crypto.randomUUID();
  const mgr = await signupManager(ip);

  for (let i = 0; i < 3; i++) {
    await app.request("/api/animals", {
      method: "POST",
      headers: authHeaders(mgr),
      body: JSON.stringify({ name: `Sheep-${i}`, animal_type: "sheep" }),
    });
  }

  const pageRes = await app.request("/api/animals?page=1&limit=2", {
    headers: authHeaders(mgr),
  });
  const page = await pageRes.json();
  assertEquals(page.total, 3);
  assertEquals(page.items.length, 2);
  assertEquals(page.limit, 2);

  const invalidRes = await app.request("/api/animals?page=0", {
    headers: authHeaders(mgr),
  });
  assertEquals(invalidRes.status, 422);

  await cleanupFarm(mgr.farmId);
});

Deno.test("unauthenticated requests are rejected", async () => {
  const res = await app.request("/api/animals");
  assertEquals(res.status, 401);
});
