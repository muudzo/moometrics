// Port of backend/tests/test_deaths.py's core scenarios, run against the real
// Hono router (Hono's app.request() plays the role of FastAPI's TestClient)
// and a real local Postgres. authRouter is mounted alongside deathsRouter so
// sessions are created the same way a real client would (see auth.test.ts).
//
// Live Supabase Storage credentials aren't available in this local dev
// environment, so every test constructs its own Hono app via
// createDeathsRouter({ saveFn, deleteFn, resolveUrl }) with in-memory fakes
// instead of using the `deathsRouter` singleton (which defaults to the real
// storageService calls, exercised only in production/staging).
import { assert, assertEquals } from "@std/assert";
import { Hono } from "hono";
import { createDeathsRouter, deathsRouter } from "./deaths.ts";
import { authRouter } from "./auth.ts";
import { getDb } from "../../_shared/db.ts";

// --- Fixture images --------------------------------------------------------
// 1x1 transparent PNG / GIF — real, magic-byte-valid images so file-type's
// sniffing in imageService.ts accepts them, just like a real upload would.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
// Minimal valid 1x1 JPEG — a distinct real format/hash from the png/gif
// fixtures above, used where a test needs a third non-colliding image.
const JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

function bytesFromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function pngFile(name = "photo.png"): File {
  return new File([bytesFromBase64(PNG_BASE64)], name, { type: "image/png" });
}

function gifFile(name = "photo.gif"): File {
  return new File([bytesFromBase64(GIF_BASE64)], name, { type: "image/gif" });
}

function jpegFile(name = "photo.jpg"): File {
  return new File([bytesFromBase64(JPEG_BASE64)], name, { type: "image/jpeg" });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Fake storage ------------------------------------------------------
function makeFakeStorage() {
  const objects = new Map<string, Uint8Array>();
  const deleted: string[] = [];
  const saveFn = (
    key: string,
    data: Uint8Array,
    _contentType: string,
  ): Promise<string> => {
    objects.set(key, data);
    return Promise.resolve(key);
  };
  const deleteFn = (key: string): Promise<void> => {
    deleted.push(key);
    objects.delete(key);
    return Promise.resolve();
  };
  const resolveUrl = (key: string): Promise<string> =>
    Promise.resolve(`https://fake.local/signed/${key}`);
  return { objects, deleted, saveFn, deleteFn, resolveUrl };
}

function buildApp(deps: Parameters<typeof createDeathsRouter>[0] = {}) {
  return new Hono()
    .route("/api/auth", authRouter)
    .route("/api/deaths", createDeathsRouter(deps));
}

function testHeaders(ip: string, extra: Record<string, string> = {}) {
  return { "x-forwarded-for": ip, ...extra };
}

function uniqueUsername(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

interface Session {
  username: string;
  userId: number;
  farmId: number;
  token: string;
}

async function signupManager(
  app: Hono,
  ip: string,
  prefix: string,
  farmName?: string,
): Promise<Session> {
  const username = uniqueUsername(prefix);
  const res = await app.request("/api/auth/signup", {
    method: "POST",
    headers: { ...testHeaders(ip), "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password: "GoodPass1",
      farm_name: farmName,
    }),
  });
  assertEquals(res.status, 201);
  const body = await res.json();
  return {
    username,
    userId: body.user_id,
    farmId: body.farm_id,
    token: body.access_token,
  };
}

async function registerEmployee(
  app: Hono,
  ip: string,
  manager: Session,
  prefix: string,
): Promise<Session> {
  const username = uniqueUsername(prefix);
  const registerRes = await app.request("/api/auth/register", {
    method: "POST",
    headers: {
      ...testHeaders(ip),
      "Content-Type": "application/json",
      Authorization: `Bearer ${manager.token}`,
    },
    body: JSON.stringify({ username, password: "GoodPass1", role: "employee" }),
  });
  assertEquals(registerRes.status, 201);
  const registered = await registerRes.json();

  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: { ...testHeaders(ip), "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  assertEquals(loginRes.status, 200);
  const loginBody = await loginRes.json();
  return {
    username,
    userId: registered.id,
    farmId: manager.farmId,
    token: loginBody.access_token,
  };
}

async function createAnimal(
  farmId: number,
  addedByUserId: number,
  name = "Bessie",
  status: "alive" | "dead" = "alive",
): Promise<number> {
  const sql = getDb();
  const [animal] = await sql<{ id: number }[]>`
    insert into animals (farm_id, name, animal_type, status, added_by_user_id)
    values (${farmId}, ${name}, 'cattle', ${status}, ${addedByUserId})
    returning id
  `;
  return animal.id;
}

async function postDeath(
  app: Hono,
  ip: string,
  token: string,
  fields: Record<string, string>,
  file: File,
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append("file", file);
  return await app.request("/api/deaths", {
    method: "POST",
    headers: { ...testHeaders(ip), Authorization: `Bearer ${token}` },
    body: form,
  });
}

async function cleanupFarm(farmId: number): Promise<void> {
  const sql = getDb();
  await sql`delete from death_records where farm_id = ${farmId}`;
  await sql`delete from animals where farm_id = ${farmId}`;
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

// --- Tests -----------------------------------------------------------------

Deno.test("deathsRouter (production singleton) is a real Hono app with no test overrides", () => {
  // Sanity check that the default export wires up createDeathsRouter() with
  // zero injected deps, i.e. it will call the real saveObject/deleteObject/
  // signedUrl from storageService.ts. We don't invoke a request against it
  // here (that would require live Supabase Storage credentials).
  assert(deathsRouter instanceof Hono);
});

Deno.test("employee can create a death report; animal becomes dead; storage save is invoked", async () => {
  const ip = crypto.randomUUID();
  const app = buildApp();
  const storage = makeFakeStorage();
  const appWithStorage = buildApp(storage);

  const manager = await signupManager(app, ip, "mgr");
  const employee = await registerEmployee(app, ip, manager, "emp");
  const animalId = await createAnimal(manager.farmId, manager.userId, "Bessie");

  const res = await postDeath(
    appWithStorage,
    ip,
    employee.token,
    {
      animal_id: String(animalId),
      cause_of_death: "Old age",
      date_of_death: "2024-01-15",
    },
    pngFile(),
  );
  assertEquals(res.status, 201);
  const body = await res.json();
  assertEquals(body.animal_id, animalId);
  assertEquals(body.reported_by_user_id, employee.userId);
  assertEquals(body.cause_of_death, "Old age");
  assertEquals(body.date_of_death, "2024-01-15");
  assert(body.image_path.startsWith("https://fake.local/signed/"));
  assert(
    !("image_hash" in body),
    "image_hash must never be exposed in the response",
  );

  // The image must have actually been persisted via the injected saveFn.
  assertEquals(storage.objects.size, 1);
  const [savedKey] = [...storage.objects.keys()];
  assert(
    savedKey.startsWith(`${manager.farmId}/`),
    "storage key must be scoped by farm id",
  );
  assert(savedKey.endsWith(".png"));

  const sql = getDb();
  const [animal] = await sql<
    { status: string }[]
  >`select status from animals where id = ${animalId}`;
  assertEquals(animal.status, "dead");

  await cleanupFarm(manager.farmId);
});

Deno.test("animal not alive rejects a second death report with 400", async () => {
  const ip = crypto.randomUUID();
  const app = buildApp();
  const storage = makeFakeStorage();
  const appWithStorage = buildApp(storage);

  const manager = await signupManager(app, ip, "mgr");
  const animalId = await createAnimal(manager.farmId, manager.userId, "Daisy");

  const first = await postDeath(
    appWithStorage,
    ip,
    manager.token,
    {
      animal_id: String(animalId),
      cause_of_death: "Illness",
      date_of_death: "2024-02-01",
    },
    pngFile(),
  );
  assertEquals(first.status, 201);

  // Different image bytes (gif, not png) so this exercises the "already
  // dead" precondition rather than the duplicate-image-hash path.
  const second = await postDeath(
    appWithStorage,
    ip,
    manager.token,
    {
      animal_id: String(animalId),
      cause_of_death: "Illness again",
      date_of_death: "2024-02-02",
    },
    gifFile(),
  );
  assertEquals(second.status, 400);
  const body = await second.json();
  assert(body.detail.includes("already recorded as dead"));

  await cleanupFarm(manager.farmId);
});

Deno.test("duplicate image hash within a farm returns 409; the same hash in a different farm is not a duplicate", async () => {
  const ip = crypto.randomUUID();
  const app = buildApp();
  const storage = makeFakeStorage();
  const appWithStorage = buildApp(storage);

  const manager = await signupManager(app, ip, "mgr");
  const animalA = await createAnimal(
    manager.farmId,
    manager.userId,
    "Animal A",
  );
  const animalB = await createAnimal(
    manager.farmId,
    manager.userId,
    "Animal B",
  );

  const first = await postDeath(
    appWithStorage,
    ip,
    manager.token,
    {
      animal_id: String(animalA),
      cause_of_death: "Cause A",
      date_of_death: "2024-03-01",
    },
    pngFile(),
  );
  assertEquals(first.status, 201);

  const dup = await postDeath(
    appWithStorage,
    ip,
    manager.token,
    {
      animal_id: String(animalB),
      cause_of_death: "Cause B",
      date_of_death: "2024-03-02",
    },
    pngFile(),
  );
  assertEquals(dup.status, 409);
  const dupBody = await dup.json();
  assert(dupBody.detail.includes("already been used"));

  // Same image bytes, different farm — must succeed, proving the dedup is
  // scoped by farm_id (uq_death_farm_image_hash), not global.
  const otherManager = await signupManager(app, crypto.randomUUID(), "mgr2");
  const otherAnimal = await createAnimal(
    otherManager.farmId,
    otherManager.userId,
    "Other Farm Animal",
  );
  const otherFarmReport = await postDeath(
    appWithStorage,
    crypto.randomUUID(),
    otherManager.token,
    {
      animal_id: String(otherAnimal),
      cause_of_death: "Cause C",
      date_of_death: "2024-03-03",
    },
    pngFile(),
  );
  assertEquals(otherFarmReport.status, 201);

  await cleanupFarm(manager.farmId);
  await cleanupFarm(otherManager.farmId);
});

Deno.test("DB insert failing after image save triggers compensating delete and 409", async () => {
  const ip = crypto.randomUUID();
  const app = buildApp();
  const manager = await signupManager(app, ip, "mgr");
  const animalId = await createAnimal(
    manager.farmId,
    manager.userId,
    "Racer Target",
  );

  const objects = new Map<string, Uint8Array>();
  const deleted: string[] = [];

  // Simulates a concurrent request winning the race: as a side effect of
  // "saving" our image, a competing death_records row for the SAME animal
  // is inserted directly — this recreates the exact TOCTOU window deaths.py
  // guards against (image already durably saved, then our own INSERT hits
  // the unique animal_id constraint).
  const racingSaveFn = async (
    key: string,
    data: Uint8Array,
    _contentType: string,
  ) => {
    objects.set(key, data);
    const sql = getDb();
    await sql`
      insert into death_records
        (farm_id, animal_id, reported_by_user_id, cause_of_death, date_of_death, image_path, image_hash, notes)
      values (
        ${manager.farmId}, ${animalId}, ${manager.userId}, 'Racer wins', '2024-04-01',
        'racer/path.png', ${"a".repeat(64)}, null
      )
    `;
    return key;
  };
  const deleteFn = (key: string) => {
    deleted.push(key);
    objects.delete(key);
    return Promise.resolve();
  };
  const resolveUrl = (key: string) =>
    Promise.resolve(`https://fake.local/signed/${key}`);

  const appWithRace = buildApp({ saveFn: racingSaveFn, deleteFn, resolveUrl });

  const res = await postDeath(
    appWithRace,
    ip,
    manager.token,
    {
      animal_id: String(animalId),
      cause_of_death: "Loses race",
      date_of_death: "2024-04-02",
    },
    pngFile(),
  );
  assertEquals(res.status, 409);
  const body = await res.json();
  assert(body.detail.includes("already exists"));

  // The object we saved must have been cleaned up.
  assertEquals(deleted.length, 1);
  assertEquals(objects.size, 0);

  // Only the racer's row exists — our insert was rolled back.
  const sql = getDb();
  const rows = await sql<{ cause_of_death: string }[]>`
    select cause_of_death from death_records where animal_id = ${animalId}
  `;
  assertEquals(rows.length, 1);
  assertEquals(rows[0].cause_of_death, "Racer wins");

  await cleanupFarm(manager.farmId);
});

Deno.test("animal not found (wrong farm) returns 404 on death report submission", async () => {
  const ip = crypto.randomUUID();
  const app = buildApp();
  const storage = makeFakeStorage();
  const appWithStorage = buildApp(storage);

  const managerA = await signupManager(app, ip, "mgrA");
  const managerB = await signupManager(app, crypto.randomUUID(), "mgrB");
  const animalInFarmB = await createAnimal(
    managerB.farmId,
    managerB.userId,
    "Farm B Animal",
  );

  const res = await postDeath(
    appWithStorage,
    ip,
    managerA.token,
    {
      animal_id: String(animalInFarmB),
      cause_of_death: "Cause",
      date_of_death: "2024-05-01",
    },
    pngFile(),
  );
  assertEquals(res.status, 404);

  await cleanupFarm(managerA.farmId);
  await cleanupFarm(managerB.farmId);
});

Deno.test("list: employee sees only own reports; manager sees all", async () => {
  const ip = crypto.randomUUID();
  const app = buildApp();
  const storage = makeFakeStorage();
  const appWithStorage = buildApp(storage);

  const manager = await signupManager(app, ip, "mgr");
  const employeeA = await registerEmployee(app, ip, manager, "empA");
  const employeeB = await registerEmployee(app, ip, manager, "empB");

  const animal1 = await createAnimal(manager.farmId, manager.userId, "A1");
  const animal2 = await createAnimal(manager.farmId, manager.userId, "A2");
  const animal3 = await createAnimal(manager.farmId, manager.userId, "A3");

  await postDeath(
    appWithStorage,
    ip,
    employeeA.token,
    {
      animal_id: String(animal1),
      cause_of_death: "C1",
      date_of_death: "2024-06-01",
    },
    pngFile("a.png"),
  );
  await postDeath(
    appWithStorage,
    ip,
    employeeA.token,
    {
      animal_id: String(animal2),
      cause_of_death: "C2",
      date_of_death: "2024-06-02",
    },
    gifFile("b.gif"),
  );
  await postDeath(
    appWithStorage,
    ip,
    employeeB.token,
    {
      animal_id: String(animal3),
      cause_of_death: "C3",
      date_of_death: "2024-06-03",
    },
    jpegFile("c.jpg"),
  );

  const asEmployeeA = await appWithStorage.request("/api/deaths", {
    headers: { ...testHeaders(ip), Authorization: `Bearer ${employeeA.token}` },
  });
  assertEquals(asEmployeeA.status, 200);
  const employeeABody = await asEmployeeA.json();
  assertEquals(employeeABody.total, 2);
  assert(
    employeeABody.items.every((r: { reported_by_user_id: number }) =>
      r.reported_by_user_id === employeeA.userId
    ),
  );

  const asManager = await appWithStorage.request("/api/deaths", {
    headers: { ...testHeaders(ip), Authorization: `Bearer ${manager.token}` },
  });
  assertEquals(asManager.status, 200);
  const managerBody = await asManager.json();
  assertEquals(managerBody.total, 3);

  await cleanupFarm(manager.farmId);
});

Deno.test("check-hash reports existence scoped to the caller's farm; validates hash length", async () => {
  const ip = crypto.randomUUID();
  const app = buildApp();
  const storage = makeFakeStorage();
  const appWithStorage = buildApp(storage);

  const manager = await signupManager(app, ip, "mgr");
  const otherManager = await signupManager(app, crypto.randomUUID(), "mgr2");
  const animalId = await createAnimal(manager.farmId, manager.userId, "Hashy");
  const hash = await sha256Hex(bytesFromBase64(PNG_BASE64));

  const beforeRes = await appWithStorage.request(
    `/api/deaths/check-hash?hash=${hash}`,
    {
      headers: { ...testHeaders(ip), Authorization: `Bearer ${manager.token}` },
    },
  );
  assertEquals(beforeRes.status, 200);
  assertEquals((await beforeRes.json()).exists, false);

  const created = await postDeath(
    appWithStorage,
    ip,
    manager.token,
    {
      animal_id: String(animalId),
      cause_of_death: "Cause",
      date_of_death: "2024-07-01",
    },
    pngFile(),
  );
  assertEquals(created.status, 201);

  const afterRes = await appWithStorage.request(
    `/api/deaths/check-hash?hash=${hash}`,
    {
      headers: { ...testHeaders(ip), Authorization: `Bearer ${manager.token}` },
    },
  );
  assertEquals((await afterRes.json()).exists, true);

  // Different farm never saw this hash.
  const otherFarmRes = await appWithStorage.request(
    `/api/deaths/check-hash?hash=${hash}`,
    {
      headers: {
        ...testHeaders(ip),
        Authorization: `Bearer ${otherManager.token}`,
      },
    },
  );
  assertEquals((await otherFarmRes.json()).exists, false);

  const badLengthRes = await appWithStorage.request(
    `/api/deaths/check-hash?hash=tooshort`,
    {
      headers: { ...testHeaders(ip), Authorization: `Bearer ${manager.token}` },
    },
  );
  assertEquals(badLengthRes.status, 422);

  await cleanupFarm(manager.farmId);
  await cleanupFarm(otherManager.farmId);
});

Deno.test("CSV export has the expected header/format and respects employee-self scoping", async () => {
  const ip = crypto.randomUUID();
  const app = buildApp();
  const storage = makeFakeStorage();
  const appWithStorage = buildApp(storage);

  const manager = await signupManager(app, ip, "mgr");
  const employee = await registerEmployee(app, ip, manager, "emp");
  const animal1 = await createAnimal(manager.farmId, manager.userId, "CsvA");
  const animal2 = await createAnimal(manager.farmId, manager.userId, "CsvB");

  await postDeath(
    appWithStorage,
    ip,
    manager.token,
    {
      animal_id: String(animal1),
      cause_of_death: "Manager cause",
      date_of_death: "2024-08-01",
    },
    pngFile("m.png"),
  );
  await postDeath(
    appWithStorage,
    ip,
    employee.token,
    {
      animal_id: String(animal2),
      cause_of_death: "Employee cause",
      date_of_death: "2024-08-02",
    },
    gifFile("e.gif"),
  );

  const managerCsvRes = await appWithStorage.request("/api/deaths/export.csv", {
    headers: { ...testHeaders(ip), Authorization: `Bearer ${manager.token}` },
  });
  assertEquals(managerCsvRes.status, 200);
  assertEquals(managerCsvRes.headers.get("content-type"), "text/csv");
  assert(
    managerCsvRes.headers.get("content-disposition")?.includes("deaths.csv"),
  );
  const managerCsv = await managerCsvRes.text();
  const managerLines = managerCsv.trim().split("\r\n");
  assertEquals(
    managerLines[0],
    "id,animal_id,reported_by_user_id,cause_of_death,date_of_death,notes,created_at",
  );
  assertEquals(managerLines.length, 3); // header + 2 rows

  const employeeCsvRes = await appWithStorage.request(
    "/api/deaths/export.csv",
    {
      headers: {
        ...testHeaders(ip),
        Authorization: `Bearer ${employee.token}`,
      },
    },
  );
  const employeeCsv = await employeeCsvRes.text();
  const employeeLines = employeeCsv.trim().split("\r\n");
  assertEquals(employeeLines.length, 2); // header + 1 own row
  assert(employeeLines[1].includes("Employee cause"));

  await cleanupFarm(manager.farmId);
});

Deno.test("get by id: 404 cross-tenant, 403 for another employee's report, manager can view any", async () => {
  const ip = crypto.randomUUID();
  const app = buildApp();
  const storage = makeFakeStorage();
  const appWithStorage = buildApp(storage);

  const manager = await signupManager(app, ip, "mgr");
  const employeeA = await registerEmployee(app, ip, manager, "empA");
  const employeeB = await registerEmployee(app, ip, manager, "empB");
  const otherManager = await signupManager(app, crypto.randomUUID(), "mgr2");

  const animalId = await createAnimal(
    manager.farmId,
    manager.userId,
    "GetById",
  );
  const createRes = await postDeath(
    appWithStorage,
    ip,
    employeeA.token,
    {
      animal_id: String(animalId),
      cause_of_death: "Cause",
      date_of_death: "2024-09-01",
    },
    pngFile(),
  );
  assertEquals(createRes.status, 201);
  const created = await createRes.json();

  const ownerRes = await appWithStorage.request(`/api/deaths/${created.id}`, {
    headers: { ...testHeaders(ip), Authorization: `Bearer ${employeeA.token}` },
  });
  assertEquals(ownerRes.status, 200);

  const otherEmployeeRes = await appWithStorage.request(
    `/api/deaths/${created.id}`,
    {
      headers: {
        ...testHeaders(ip),
        Authorization: `Bearer ${employeeB.token}`,
      },
    },
  );
  assertEquals(otherEmployeeRes.status, 403);

  const managerRes = await appWithStorage.request(`/api/deaths/${created.id}`, {
    headers: { ...testHeaders(ip), Authorization: `Bearer ${manager.token}` },
  });
  assertEquals(managerRes.status, 200);

  const crossTenantRes = await appWithStorage.request(
    `/api/deaths/${created.id}`,
    {
      headers: {
        ...testHeaders(ip),
        Authorization: `Bearer ${otherManager.token}`,
      },
    },
  );
  assertEquals(crossTenantRes.status, 404);

  await cleanupFarm(manager.farmId);
  await cleanupFarm(otherManager.farmId);
});
