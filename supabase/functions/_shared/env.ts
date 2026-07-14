// Port of backend/app/config.py — typed env loader + the same hard production
// startup guards (refuse to boot with placeholder secrets / sqlite / default
// admin password). Read once per isolate; Edge Function isolates are
// short-lived, so no need for the Python side's @lru_cache singleton dance,
// but we still only want to validate once per cold start.

export type Environment = "development" | "staging" | "production";

export interface Settings {
  environment: Environment;
  isProduction: boolean;
  isDevelopment: boolean;

  frontendUrl: string;

  jwtSecret: string;
  jwtAlgorithm: "HS256";
  jwtIssuer: string;
  accessTokenExpireMinutes: number;
  refreshTokenExpireDays: number;
  refreshCookieName: string;

  maxFailedLogins: number;
  lockoutMinutes: number;

  databaseUrl: string;

  storageBucket: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;

  adminUsername: string;
  adminInitialPassword: string;
  defaultFarmName: string;
}

function env(name: string, fallback: string): string {
  return Deno.env.get(name) ?? fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  return raw ? parseInt(raw, 10) : fallback;
}

let cached: Settings | null = null;

export function getSettings(): Settings {
  if (cached) return cached;

  const environment = env("ENVIRONMENT", "development") as Environment;
  const isProduction = environment === "production";
  const isDevelopment = environment === "development";

  const settings: Settings = {
    environment,
    isProduction,
    isDevelopment,
    frontendUrl: env("FRONTEND_URL", "http://localhost:3000"),

    jwtSecret: env("JWT_SECRET", "change-me-in-production"),
    jwtAlgorithm: "HS256",
    jwtIssuer: env("JWT_ISSUER", "moometrics"),
    accessTokenExpireMinutes: envInt("ACCESS_TOKEN_EXPIRE_MINUTES", 15),
    refreshTokenExpireDays: envInt("REFRESH_TOKEN_EXPIRE_DAYS", 30),
    refreshCookieName: env("REFRESH_COOKIE_NAME", "moometrics_refresh"),

    maxFailedLogins: envInt("MAX_FAILED_LOGINS", 5),
    lockoutMinutes: envInt("LOCKOUT_MINUTES", 15),

    databaseUrl: env("DATABASE_URL", ""),

    storageBucket: env("S3_BUCKET", "moometrics"),
    supabaseUrl: env("SUPABASE_URL", ""),
    supabaseServiceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY", ""),

    adminUsername: env("ADMIN_USERNAME", "admin"),
    adminInitialPassword: env("ADMIN_INITIAL_PASSWORD", "admin123"),
    defaultFarmName: env("DEFAULT_FARM_NAME", "Default Farm"),
  };

  validateProductionSafety(settings);
  cached = settings;
  return settings;
}

/** Mirrors config.py's model_post_init hard guards. Throws (refuses to serve
 * requests) rather than silently booting with an insecure production config. */
export function validateProductionSafety(settings: Settings): void {
  if (!settings.isProduction) return;

  if (settings.jwtSecret === "change-me-in-production") {
    throw new Error("JWT_SECRET must be set to a strong value in production");
  }
  if (settings.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
  if (!settings.databaseUrl.startsWith("postgres")) {
    throw new Error("DATABASE_URL must point at PostgreSQL in production");
  }
  if (settings.adminInitialPassword === "admin123") {
    throw new Error(
      "ADMIN_INITIAL_PASSWORD must be set to a strong value in production " +
        "(the default 'admin123' is not allowed)",
    );
  }
}

/** Test-only: reset the cached singleton between test cases. */
export function _resetSettingsCacheForTests(): void {
  cached = null;
}
