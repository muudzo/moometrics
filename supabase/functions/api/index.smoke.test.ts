// index.ts calls Deno.serve() at module scope (required for Edge Function
// deployment), so it can't be imported directly in a test without starting a
// real listener. This reconstructs the identical composition instead, to
// verify the full app — CORS/security headers + all 6 routers mounted
// together under /api/* — actually works end-to-end, not just each router
// in isolation.
import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { corsMiddleware, securityHeaders } from "../_shared/cors.ts";
import { authRouter } from "./routers/auth.ts";
import { animalsRouter } from "./routers/animals.ts";
import { deathsRouter } from "./routers/deaths.ts";
import { usersRouter } from "./routers/users.ts";
import { feedRouter } from "./routers/feed.ts";
import { dashboardRouter } from "./routers/dashboard.ts";
import { auditRouter } from "./routers/audit.ts";
import { getDb } from "../_shared/db.ts";

const app = new Hono();
app.use("*", corsMiddleware());
app.use("*", securityHeaders);
app.get("/api/health", (c) => c.json({ status: "healthy" }));
app.route("/api/auth", authRouter);
app.route("/api/animals", animalsRouter);
app.route("/api/deaths", deathsRouter);
app.route("/api/users", usersRouter);
app.route("/api/feed", feedRouter);
app.route("/api/dashboard", dashboardRouter);
app.route("/api/audit", auditRouter);

function uniqueUsername(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

Deno.test("composed app: /api/health responds", async () => {
  const res = await app.request("/api/health");
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { status: "healthy" });
});

Deno.test("composed app: security headers present on every response", async () => {
  const res = await app.request("/api/health");
  assertEquals(res.headers.get("x-content-type-options"), "nosniff");
  assertEquals(res.headers.get("x-frame-options"), "DENY");
});

Deno.test("composed app: CORS preflight for the configured frontend origin succeeds", async () => {
  const res = await app.request("/api/animals", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:3000",
      "Access-Control-Request-Method": "GET",
    },
  });
  assertEquals(res.status, 204);
  assertEquals(
    res.headers.get("access-control-allow-origin"),
    "http://localhost:3000",
  );
});

Deno.test("composed app: full flow — signup, create animal, dashboard reflects it", async () => {
  const ip = crypto.randomUUID();
  const username = uniqueUsername("e2e");
  const signupRes = await app.request("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ username, password: "GoodPass1" }),
  });
  assertEquals(signupRes.status, 201);
  const { access_token, farm_id, user_id } = await signupRes.json();

  const createRes = await app.request("/api/animals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access_token}`,
    },
    body: JSON.stringify({ name: "Bessie", animal_type: "cattle" }),
  });
  assertEquals(createRes.status, 201);

  const statsRes = await app.request("/api/dashboard/stats", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  assertEquals(statsRes.status, 200);
  const stats = await statsRes.json();
  assertEquals(stats.total_animals, 1);
  assertEquals(stats.alive_count, 1);

  const sql = getDb();
  await sql`delete from animals where farm_id = ${farm_id}`;
  await sql`delete from audit_logs where farm_id = ${farm_id}`;
  await sql`delete from refresh_tokens where user_id = ${user_id}`;
  await sql`delete from users where id = ${user_id}`;
  await sql`delete from farms where id = ${farm_id}`;
});
