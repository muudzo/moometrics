// Port of app/main.py's _cors_origins()/_normalize_origin() and
// SecurityHeadersMiddleware.
import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";
import { getSettings } from "./env.ts";

function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function corsOrigins(): string[] {
  const settings = getSettings();
  const origins = [normalizeOrigin(settings.frontendUrl)];
  if (settings.isDevelopment) {
    origins.push("http://localhost:3000");
  }
  return origins;
}

export function corsMiddleware(): MiddlewareHandler {
  const origins = corsOrigins();
  return cors({
    origin: (
      origin: string,
    ) => (origins.includes(origin) ? origin : origins[0]),
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 3600,
  });
}

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  if (getSettings().isProduction) {
    c.header(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains",
    );
  }
};
