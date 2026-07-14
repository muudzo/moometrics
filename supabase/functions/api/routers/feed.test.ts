// Feed inventory tests, run against the real Hono router and local Postgres.
// The idempotent-replay test is the load-bearing one: it proves the offline
// outbox can safely re-POST a transaction whose response was lost.
import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { authRouter } from "./auth.ts";
import { feedRouter } from "./feed.ts";
import { getDb } from "../../_shared/db.ts";

const app = new Hono()
  .route("/api/auth", authRouter)
  .route("/api/feed", feedRouter);

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

interface Session {
  username: string;
  userId: number;
  farmId: number;
  token: string;
}

async function signupManager(ip: string, prefix: string): Promise<Session> {
  const username = uniqueUsername(prefix);
  const res = await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  const body = await res.json();
  return {
    username,
    userId: body.user_id,
    farmId: body.farm_id,
    token: body.access_token,
  };
}

async function registerEmployee(
  ip: string,
  manager: Session,
  prefix: string,
): Promise<Session> {
  const username = uniqueUsername(prefix);
  await app.request("/api/auth/register", {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
    body: JSON.stringify({ username, password: "GoodPass1", role: "employee" }),
  });
  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  const body = await loginRes.json();
  return {
    username,
    userId: body.user_id,
    farmId: manager.farmId,
    token: body.access_token,
  };
}

async function cleanupFarm(farmId: number): Promise<void> {
  const sql = getDb();
  await sql`delete from feed_transactions where farm_id = ${farmId}`;
  await sql`delete from feed_items where farm_id = ${farmId}`;
  await sql`delete from audit_logs where farm_id = ${farmId}`;
  const users = await sql<
    { id: number }[]
  >`select id from users where farm_id = ${farmId}`;
  for (const u of users) {
    await sql`delete from refresh_tokens where user_id = ${u.id}`;
  }
  await sql`delete from users where farm_id = ${farmId}`;
  await sql`delete from farms where id = ${farmId}`;
}

async function createItem(
  session: Session,
  ip: string,
  name: string,
  quantity = 10,
  threshold = 5,
) {
  const res = await app.request("/api/feed", {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${session.token}` }),
    body: JSON.stringify({
      name,
      quantity,
      low_stock_threshold: threshold,
    }),
  });
  return res;
}

Deno.test("manager can create a feed item; duplicate name in same farm is 409", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "feedcreate");

  const res = await createItem(manager, ip, "Dairy Meal");
  assertEquals(res.status, 201);
  const item = await res.json();
  assertEquals(item.name, "Dairy Meal");
  assertEquals(item.quantity, 10);

  const dup = await createItem(manager, ip, "Dairy Meal");
  assertEquals(dup.status, 409);

  await cleanupFarm(manager.farmId);
});

Deno.test("employee cannot create/edit/delete feed items but can list them", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "feedroles");
  const employee = await registerEmployee(ip, manager, "feedemp");
  const created = await (await createItem(manager, ip, "Hay")).json();

  const createRes = await createItem(employee, ip, "Illegal");
  assertEquals(createRes.status, 403);

  const editRes = await app.request(`/api/feed/${created.id}`, {
    method: "PUT",
    headers: testHeaders(ip, { Authorization: `Bearer ${employee.token}` }),
    body: JSON.stringify({ low_stock_threshold: 1 }),
  });
  assertEquals(editRes.status, 403);

  const deleteRes = await app.request(`/api/feed/${created.id}`, {
    method: "DELETE",
    headers: testHeaders(ip, { Authorization: `Bearer ${employee.token}` }),
  });
  assertEquals(deleteRes.status, 403);

  const listRes = await app.request("/api/feed", {
    headers: testHeaders(ip, { Authorization: `Bearer ${employee.token}` }),
  });
  assertEquals(listRes.status, 200);
  const page = await listRes.json();
  assertEquals(page.items.length, 1);

  await cleanupFarm(manager.farmId);
});

Deno.test("transactions adjust the balance atomically; employee can record usage", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "feedtxn");
  const employee = await registerEmployee(ip, manager, "feedtxnemp");
  const item = await (await createItem(manager, ip, "Chicken Feed", 20)).json();

  const usage = await app.request(`/api/feed/${item.id}/transactions`, {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${employee.token}` }),
    body: JSON.stringify({
      delta: -3,
      reason: "Morning feed",
      client_txn_id: crypto.randomUUID(),
    }),
  });
  assertEquals(usage.status, 201);
  const usageBody = await usage.json();
  assertEquals(usageBody.item.quantity, 17);
  assertEquals(usageBody.duplicate, false);

  const restock = await app.request(`/api/feed/${item.id}/transactions`, {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
    body: JSON.stringify({
      delta: 10,
      reason: "Delivery",
      client_txn_id: crypto.randomUUID(),
    }),
  });
  assertEquals((await restock.json()).item.quantity, 27);

  await cleanupFarm(manager.farmId);
});

Deno.test("IDEMPOTENT REPLAY: same client_txn_id twice -> success both times, balance moves once", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "feedidem");
  const item = await (await createItem(manager, ip, "Silage", 10)).json();
  const txnId = crypto.randomUUID();

  const first = await app.request(`/api/feed/${item.id}/transactions`, {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
    body: JSON.stringify({ delta: -4, client_txn_id: txnId }),
  });
  assertEquals(first.status, 201);
  assertEquals((await first.json()).item.quantity, 6);

  // Simulates the outbox re-POSTing after the response was lost in transit.
  const replay = await app.request(`/api/feed/${item.id}/transactions`, {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
    body: JSON.stringify({ delta: -4, client_txn_id: txnId }),
  });
  assertEquals(replay.status, 200);
  const replayBody = await replay.json();
  assertEquals(replayBody.duplicate, true);
  assertEquals(replayBody.item.quantity, 6); // NOT 2 — the delta applied once

  const sql = getDb();
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from feed_transactions where client_txn_id = ${txnId}
  `;
  assertEquals(count, 1);

  await cleanupFarm(manager.farmId);
});

Deno.test("negative balance is allowed (late-syncing usage must not be dropped)", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "feedneg");
  const item = await (await createItem(manager, ip, "Pellets", 2)).json();

  const res = await app.request(`/api/feed/${item.id}/transactions`, {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
    body: JSON.stringify({ delta: -5, client_txn_id: crypto.randomUUID() }),
  });
  assertEquals(res.status, 201);
  assertEquals((await res.json()).item.quantity, -3);

  await cleanupFarm(manager.farmId);
});

Deno.test("zero delta and bad client_txn_id are rejected with 422", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "feedval");
  const item = await (await createItem(manager, ip, "Bran")).json();

  const zero = await app.request(`/api/feed/${item.id}/transactions`, {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
    body: JSON.stringify({ delta: 0, client_txn_id: crypto.randomUUID() }),
  });
  assertEquals(zero.status, 422);

  const badId = await app.request(`/api/feed/${item.id}/transactions`, {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
    body: JSON.stringify({ delta: 1, client_txn_id: "not-a-uuid" }),
  });
  assertEquals(badId.status, 422);

  await cleanupFarm(manager.farmId);
});

Deno.test("cross-tenant isolation: farm B cannot see or transact on farm A's feed", async () => {
  const ip = crypto.randomUUID();
  const managerA = await signupManager(ip, "feedfarmA");
  const managerB = await signupManager(ip, "feedfarmB");
  const itemA = await (await createItem(managerA, ip, "Maize")).json();

  const get = await app.request(`/api/feed/${itemA.id}/transactions`, {
    headers: testHeaders(ip, { Authorization: `Bearer ${managerB.token}` }),
  });
  assertEquals(get.status, 404);

  const txn = await app.request(`/api/feed/${itemA.id}/transactions`, {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${managerB.token}` }),
    body: JSON.stringify({ delta: -1, client_txn_id: crypto.randomUUID() }),
  });
  assertEquals(txn.status, 404);

  const listB = await app.request("/api/feed", {
    headers: testHeaders(ip, { Authorization: `Bearer ${managerB.token}` }),
  });
  assertEquals((await listB.json()).total, 0);

  await cleanupFarm(managerB.farmId);
  await cleanupFarm(managerA.farmId);
});

Deno.test("rename/threshold edit works; transaction history lists newest first; bad ids are 422", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "feedmisc");
  const item = await (await createItem(manager, ip, "Cubes", 10)).json();

  const renamed = await app.request(`/api/feed/${item.id}`, {
    method: "PUT",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
    body: JSON.stringify({ name: "Beef Cubes", low_stock_threshold: 2 }),
  });
  assertEquals(renamed.status, 200);
  const renamedBody = await renamed.json();
  assertEquals(renamedBody.name, "Beef Cubes");
  assertEquals(renamedBody.low_stock_threshold, 2);

  for (const delta of [-1, -2]) {
    await app.request(`/api/feed/${item.id}/transactions`, {
      method: "POST",
      headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
      body: JSON.stringify({ delta, client_txn_id: crypto.randomUUID() }),
    });
  }
  const history = await app.request(`/api/feed/${item.id}/transactions`, {
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
  });
  assertEquals(history.status, 200);
  const page = await history.json();
  assertEquals(page.total, 2);
  assertEquals(page.items[0].delta, -2); // newest first

  // Non-numeric ids are rejected uniformly across the item endpoints.
  for (
    const [method, path] of [
      ["PUT", "/api/feed/abc"],
      ["DELETE", "/api/feed/abc"],
      ["POST", "/api/feed/abc/transactions"],
      ["GET", "/api/feed/abc/transactions"],
    ] as const
  ) {
    const res = await app.request(path, {
      method,
      headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
      body: method === "GET" ? undefined : JSON.stringify({}),
    });
    assertEquals(res.status, 422, `${method} ${path}`);
  }

  await cleanupFarm(manager.farmId);
});

Deno.test("deleting a feed item cascades its transaction history", async () => {
  const ip = crypto.randomUUID();
  const manager = await signupManager(ip, "feeddel");
  const item = await (await createItem(manager, ip, "Lucerne")).json();
  await app.request(`/api/feed/${item.id}/transactions`, {
    method: "POST",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
    body: JSON.stringify({ delta: -1, client_txn_id: crypto.randomUUID() }),
  });

  const del = await app.request(`/api/feed/${item.id}`, {
    method: "DELETE",
    headers: testHeaders(ip, { Authorization: `Bearer ${manager.token}` }),
  });
  assertEquals(del.status, 204);

  const sql = getDb();
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from feed_transactions where feed_item_id = ${item.id}
  `;
  assertEquals(count, 0);

  await cleanupFarm(manager.farmId);
});
