// Response helpers. Error shape intentionally matches FastAPI's
// HTTPException convention ({"detail": "<message>"}) so the frontend's
// formatErrorDetail() in frontend/src/services/api.ts needs zero changes —
// its string-detail branch already handles this; the Pydantic-422
// array-of-objects branch simply never fires against this backend.
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  detail: string,
) {
  return c.json({ detail }, status);
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function pageEnvelope<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): Page<T> {
  return { items, total, page, limit };
}

// Port of app/utils.py's CSV-formula-injection guard — a real security
// control (prevents a farm's data export from executing a formula when
// opened in Excel/Sheets), copied verbatim, not incidental.
const CSV_FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

function csvSafe(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (text.length > 0 && CSV_FORMULA_PREFIXES.includes(text[0])) {
    return "'" + text;
  }
  return text;
}

function csvEscapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function csvRow(cells: unknown[]): string {
  return cells.map((c) => csvEscapeField(csvSafe(c))).join(",") + "\r\n";
}

export function csvResponse(
  c: Context,
  filename: string,
  header: string[],
  rows: unknown[][],
): Response {
  let body = csvRow(header);
  for (const row of rows) {
    body += csvRow(row);
  }
  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(body);
}
