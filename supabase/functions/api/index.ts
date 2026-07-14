// Single Edge Function entry point. Supabase locks route paths to the
// function's own directory name (see migration plan), so every route here
// is mounted under /api/* to match the existing frontend contract exactly —
// this function must be deployed as `api` (`supabase functions deploy api`).
import { Hono } from "hono";
import { corsMiddleware, securityHeaders } from "../_shared/cors.ts";
import { authRouter } from "./routers/auth.ts";
import { animalsRouter } from "./routers/animals.ts";
import { deathsRouter } from "./routers/deaths.ts";
import { usersRouter } from "./routers/users.ts";
import { feedRouter } from "./routers/feed.ts";
import { dashboardRouter } from "./routers/dashboard.ts";
import { auditRouter } from "./routers/audit.ts";

const app = new Hono();

// Unhandled errors bypass the securityHeaders middleware (the exception
// propagates past its post-next() header writes), so headers are re-applied
// here. The body stays a generic {"detail": ...} — never the error message,
// which can carry table/constraint names from Postgres.
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  return c.json({ detail: "Internal server error" }, 500);
});

// Match FastAPI's JSON 404 shape instead of Hono's default text/plain body.
app.notFound((c) => c.json({ detail: "Not Found" }, 404));

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

Deno.serve(app.fetch);
