// Single pagination-query parser for every paginated list endpoint.
// Mirrors FastAPI's Query(1, ge=1) / Query(50, ge=1, le=200) semantics:
// a missing param falls back to its default; a present-but-invalid or
// out-of-range param is a 422. Previously each router hand-rolled its own
// copy of this with subtly different bounds and error strings.
import type { Context } from "hono";

export const PAGE_DEFAULT = 1;
export const LIMIT_DEFAULT = 50;
export const LIMIT_MAX = 200;

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export type PaginationResult =
  | { ok: true; pagination: Pagination }
  | { ok: false; error: string };

function parseBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
  field: string,
): { value: number } | { error: string } {
  if (raw === undefined) return { value: fallback };
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    const bound = max === Infinity
      ? `greater than or equal to ${min}`
      : `between ${min} and ${max}`;
    return { error: `${field}: Input should be ${bound}` };
  }
  return { value: parsed };
}

export function parsePagination(c: Context): PaginationResult {
  const page = parseBoundedInt(
    c.req.query("page"),
    PAGE_DEFAULT,
    1,
    Infinity,
    "page",
  );
  if ("error" in page) return { ok: false, error: page.error };

  const limit = parseBoundedInt(
    c.req.query("limit"),
    LIMIT_DEFAULT,
    1,
    LIMIT_MAX,
    "limit",
  );
  if ("error" in limit) return { ok: false, error: limit.error };

  return {
    ok: true,
    pagination: {
      page: page.value,
      limit: limit.value,
      offset: (page.value - 1) * limit.value,
    },
  };
}
