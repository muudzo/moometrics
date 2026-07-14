// Postgres client for Edge Functions. Points at the Supavisor transaction-mode
// pooler; { prepare: false } is required there since transaction-mode pooling
// doesn't support server-side prepared statements across short-lived
// connections (see Supabase docs: Connecting to Postgres from Edge Functions).
import postgres from "postgres";
import { getSettings } from "./env.ts";

let client: ReturnType<typeof postgres> | null = null;

export function getDb(): ReturnType<typeof postgres> {
  if (client) return client;
  const { databaseUrl } = getSettings();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  client = postgres(databaseUrl, { prepare: false });
  return client;
}

/** Postgres unique_violation error code — mirrors app/utils.py's integrity_guard,
 * which catches SQLAlchemy's IntegrityError and returns a clean 409 instead of 500. */
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";

function pgErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === PG_UNIQUE_VIOLATION;
}

export function isForeignKeyViolation(err: unknown): boolean {
  return pgErrorCode(err) === PG_FOREIGN_KEY_VIOLATION;
}

/** The postgres.js npm-compat build under this Deno runtime returns jsonb
 * columns as raw JSON text rather than auto-parsing them (verified
 * empirically). Every jsonb read must go through this. */
export function parseJsonbText(
  value: string | null,
): Record<string, unknown> | null {
  return value === null ? null : JSON.parse(value) as Record<string, unknown>;
}

/** Test-only: dispose of the cached client so tests can point at a fresh DB. */
export function _resetDbForTests(): void {
  client = null;
}
