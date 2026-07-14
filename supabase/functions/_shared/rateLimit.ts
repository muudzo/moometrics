// NEW (not a port): backend/app/rate_limit.py uses slowapi, which keeps
// counters in-process memory. That doesn't work here — Edge Functions are
// stateless and horizontally distributed, so each invocation could hit a
// different isolate with its own empty counter, silently making the limiter
// a no-op. This uses a Postgres-backed fixed-window counter instead, backed
// by the rate_limit_hits table (see supabase/migrations).
import type { Context, MiddlewareHandler } from "hono";
import { getDb } from "./db.ts";
import { jsonError } from "./response.ts";

function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64);
  return "unknown";
}

/** Returns true if the request is allowed, false if the limit was exceeded. */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const sql = getDb();
  const windowStart = new Date(
    Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000,
  );
  const [row] = await sql<{ hits: number }[]>`
    insert into rate_limit_hits (bucket, window_start, hits)
    values (${bucket}, ${windowStart}, 1)
    on conflict (bucket, window_start)
    do update set hits = rate_limit_hits.hits + 1
    returning hits
  `;
  return row.hits <= limit;
}

/** Mirrors @limiter.limit("5/minute") on the login/signup routes. */
export function rateLimit(
  name: string,
  limit: number,
  windowSeconds: number,
): MiddlewareHandler {
  return async (c, next) => {
    const bucket = `${name}:${clientIp(c)}`;
    const allowed = await checkRateLimit(bucket, limit, windowSeconds);
    if (!allowed) {
      return jsonError(c, 429, "Too many requests. Please try again later.");
    }
    await next();
  };
}
