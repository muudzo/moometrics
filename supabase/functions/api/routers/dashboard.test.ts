// Port of backend/tests/test_dashboard.py's core scenarios, run against the
// real Hono router (Hono's app.request() plays the role of FastAPI's
// TestClient) and a real local Postgres. authRouter is mounted alongside
// dashboardRouter so sessions come from a real signup, not hand-rolled JWTs.
import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { dashboardRouter } from "./dashboard.ts";
import { authRouter } from "./auth.ts";
import { getDb } from "../../_shared/db.ts";

const app = new Hono()
  .route("/api/auth", authRouter)
  .route("/api/dashboard", dashboardRouter);

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
  accessToken: string;
  userId: number;
  farmId: number;
  username: string;
}

async function signup(ip: string, prefix: string): Promise<Session> {
  const username = uniqueUsername(prefix);
  const res = await app.request("/api/auth/signup", {
    method: "POST",
    headers: testHeaders(ip),
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  const body = await res.json();
  return {
    accessToken: body.access_token,
    userId: body.user_id,
    farmId: body.farm_id,
    username,
  };
}

async function cleanupFarm(farmId: number, userIds: number[]): Promise<void> {
  const sql = getDb();
  await sql`delete from death_records where farm_id = ${farmId}`;
  await sql`delete from animals where farm_id = ${farmId}`;
  await sql`delete from audit_logs where farm_id = ${farmId}`;
  for (const userId of userIds) {
    await sql`delete from refresh_tokens where user_id = ${userId}`;
  }
  await sql`delete from users where farm_id = ${farmId}`;
  await sql`delete from farms where id = ${farmId}`;
}

interface InsertAnimalParams {
  farmId: number;
  userId: number;
  name: string;
  animalType: string;
  status: "alive" | "dead";
  createdAt: Date;
}

async function insertAnimal(params: InsertAnimalParams): Promise<number> {
  const sql = getDb();
  const [row] = await sql<{ id: number }[]>`
    insert into animals (farm_id, name, animal_type, status, added_by_user_id, created_at, updated_at)
    values (
      ${params.farmId}, ${params.name}, ${params.animalType}, ${params.status},
      ${params.userId}, ${params.createdAt}, ${params.createdAt}
    )
    returning id
  `;
  return row.id;
}

interface InsertDeathParams {
  farmId: number;
  userId: number;
  animalId: number;
  causeOfDeath: string;
  createdAt: Date;
}

async function insertDeath(params: InsertDeathParams): Promise<void> {
  const sql = getDb();
  await sql`
    insert into death_records
      (farm_id, animal_id, reported_by_user_id, cause_of_death, date_of_death, image_path, image_hash, created_at)
    values (
      ${params.farmId}, ${params.animalId}, ${params.userId}, ${params.causeOfDeath},
      ${params.createdAt}, '/uploads/deaths/test.jpg', ${crypto.randomUUID()}, ${params.createdAt}
    )
  `;
}

Deno.test("stats aggregate counts and death_rate across a mix of alive/dead animals and types", async () => {
  const ip = crypto.randomUUID();
  const session = await signup(ip, "stats");
  const base = new Date();

  const cattle1 = await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "Bessie",
    animalType: "cattle",
    status: "alive",
    createdAt: base,
  });
  await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "Daisy",
    animalType: "cattle",
    status: "alive",
    createdAt: base,
  });
  await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "Moo",
    animalType: "cattle",
    status: "alive",
    createdAt: base,
  });
  const goat1 = await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "Billy",
    animalType: "goat",
    status: "alive",
    createdAt: base,
  });
  const sheep1 = await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "Woolly",
    animalType: "sheep",
    status: "dead",
    createdAt: base,
  });
  const sheep2 = await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "Fluffy",
    animalType: "sheep",
    status: "dead",
    createdAt: base,
  });
  await insertDeath({
    farmId: session.farmId,
    userId: session.userId,
    animalId: sheep1,
    causeOfDeath: "Old age",
    createdAt: base,
  });
  await insertDeath({
    farmId: session.farmId,
    userId: session.userId,
    animalId: sheep2,
    causeOfDeath: "Illness",
    createdAt: base,
  });

  const res = await app.request("/api/dashboard/stats", {
    method: "GET",
    headers: testHeaders(ip, {
      Authorization: `Bearer ${session.accessToken}`,
    }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();

  assertEquals(body.total_animals, 6);
  assertEquals(body.alive_count, 4);
  assertEquals(body.dead_count, 2);
  // dead/total*100 = 2/6*100 = 33.333... -> round to 1 decimal place.
  assertEquals(body.death_rate, 33.3);
  assertEquals(body.type_breakdown, { cattle: 3, goat: 1, sheep: 2 });

  await cleanupFarm(session.farmId, [session.userId]);
  void cattle1;
  void goat1;
});

Deno.test("stats on a farm with zero animals returns zeroed stats, not a division error", async () => {
  const ip = crypto.randomUUID();
  const session = await signup(ip, "empty");

  const res = await app.request("/api/dashboard/stats", {
    method: "GET",
    headers: testHeaders(ip, {
      Authorization: `Bearer ${session.accessToken}`,
    }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();

  assertEquals(body.total_animals, 0);
  assertEquals(body.alive_count, 0);
  assertEquals(body.dead_count, 0);
  assertEquals(body.death_rate, 0.0);
  assertEquals(body.type_breakdown, {});
  assertEquals(body.recent_activity, []);

  await cleanupFarm(session.farmId, [session.userId]);
});

Deno.test("recent_activity merges animal_added and death_reported, sorted desc, capped at 5", async () => {
  const ip = crypto.randomUUID();
  const session = await signup(ip, "activity");
  const base = new Date();
  const minutes = (n: number) => new Date(base.getTime() + n * 60_000);

  // 7 animals, oldest to newest; the last two (A6, A7) later get death
  // records timestamped even more recently than any animal_added event, so
  // they must rank above all animal_added entries in the merged feed.
  await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "A1",
    animalType: "cattle",
    status: "alive",
    createdAt: minutes(1),
  });
  await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "A2",
    animalType: "cattle",
    status: "alive",
    createdAt: minutes(2),
  });
  const a3 = await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "A3",
    animalType: "goat",
    status: "alive",
    createdAt: minutes(3),
  });
  const a4 = await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "A4",
    animalType: "pig",
    status: "alive",
    createdAt: minutes(4),
  });
  const _a5 = await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "A5",
    animalType: "horse",
    status: "alive",
    createdAt: minutes(5),
  });
  const a6 = await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "A6",
    animalType: "chicken",
    status: "dead",
    createdAt: minutes(6),
  });
  const a7 = await insertAnimal({
    farmId: session.farmId,
    userId: session.userId,
    name: "A7",
    animalType: "other",
    status: "dead",
    createdAt: minutes(7),
  });
  await insertDeath({
    farmId: session.farmId,
    userId: session.userId,
    animalId: a6,
    causeOfDeath: "Predator",
    createdAt: minutes(10),
  });
  await insertDeath({
    farmId: session.farmId,
    userId: session.userId,
    animalId: a7,
    causeOfDeath: "Disease",
    createdAt: minutes(11),
  });

  const res = await app.request("/api/dashboard/stats", {
    method: "GET",
    headers: testHeaders(ip, {
      Authorization: `Bearer ${session.accessToken}`,
    }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();

  assertEquals(body.recent_activity.length, 5);
  const kinds = body.recent_activity.map((
    a: { type: string; description: string },
  ) => [
    a.type,
    a.description,
  ]);
  assertEquals(kinds, [
    ["death_reported", "Death reported for A7: Disease"],
    ["death_reported", "Death reported for A6: Predator"],
    ["animal_added", "A7 (other) added"],
    ["animal_added", "A6 (chicken) added"],
    ["animal_added", "A5 (horse) added"],
  ]);

  await cleanupFarm(session.farmId, [session.userId]);
  void a3;
  void a4;
});

Deno.test("farm isolation: a farm with no data never sees another farm's stats", async () => {
  const ipA = crypto.randomUUID();
  const ipB = crypto.randomUUID();
  const farmA = await signup(ipA, "farmA");
  const farmB = await signup(ipB, "farmB");

  await insertAnimal({
    farmId: farmA.farmId,
    userId: farmA.userId,
    name: "OnlyInFarmA",
    animalType: "cattle",
    status: "alive",
    createdAt: new Date(),
  });

  const resB = await app.request("/api/dashboard/stats", {
    method: "GET",
    headers: testHeaders(ipB, { Authorization: `Bearer ${farmB.accessToken}` }),
  });
  assertEquals(resB.status, 200);
  const bodyB = await resB.json();
  assertEquals(bodyB.total_animals, 0);
  assertEquals(bodyB.alive_count, 0);
  assertEquals(bodyB.dead_count, 0);
  assertEquals(bodyB.death_rate, 0.0);
  assertEquals(bodyB.type_breakdown, {});
  assertEquals(bodyB.recent_activity, []);

  const resA = await app.request("/api/dashboard/stats", {
    method: "GET",
    headers: testHeaders(ipA, { Authorization: `Bearer ${farmA.accessToken}` }),
  });
  const bodyA = await resA.json();
  assertEquals(bodyA.total_animals, 1);

  await cleanupFarm(farmA.farmId, [farmA.userId]);
  await cleanupFarm(farmB.farmId, [farmB.userId]);
});

Deno.test("stats endpoint requires authentication", async () => {
  const res = await app.request("/api/dashboard/stats", { method: "GET" });
  assertEquals(res.status, 401);
});
