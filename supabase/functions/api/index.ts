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
import { dashboardRouter } from "./routers/dashboard.ts";
import { auditRouter } from "./routers/audit.ts";

const app = new Hono();

app.use("*", corsMiddleware());
app.use("*", securityHeaders);

app.get("/api/health", (c) => c.json({ status: "healthy" }));

app.route("/api/auth", authRouter);
app.route("/api/animals", animalsRouter);
app.route("/api/deaths", deathsRouter);
app.route("/api/users", usersRouter);
app.route("/api/dashboard", dashboardRouter);
app.route("/api/audit", auditRouter);

Deno.serve(app.fetch);
