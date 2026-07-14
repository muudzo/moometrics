// Port of backend/app/models/schemas.py's Pydantic request models, mirrored
// field-for-field (including the username regex and password composition
// rule) with Zod.
import { z } from "zod";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

const username = z
  .string()
  .min(3)
  .max(32)
  .regex(
    USERNAME_PATTERN,
    "Username may only contain letters, digits, and underscores",
  );

// Pydantic's `date` type rejects malformed strings at the request-validation
// boundary (422); a bare z.string() would let e.g. "not-a-date" through to
// the Postgres insert, where it fails as an unhandled 500 instead. Match
// Pydantic's behavior with an explicit ISO-date check.
const isoDate = z.string().refine(
  (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)),
  "Invalid date format, expected YYYY-MM-DD",
);

const password = z
  .string()
  .min(8)
  .max(128)
  .refine(
    (v) => /[A-Z]/.test(v),
    "Password must contain at least one uppercase letter",
  )
  .refine(
    (v) => /[a-z]/.test(v),
    "Password must contain at least one lowercase letter",
  )
  .refine((v) => /[0-9]/.test(v), "Password must contain at least one digit");

export const LoginRequestSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(1),
});

export const SignupRequestSchema = z.object({
  username,
  password,
  farm_name: z.string().max(120).optional().nullable(),
});

export const PasswordChangeRequestSchema = z.object({
  current_password: z.string().min(1),
  new_password: password,
});

export const UserCreateSchema = z.object({
  username,
  password,
  role: z.enum(["manager", "employee"]),
});

const ANIMAL_TYPES = [
  "cattle",
  "sheep",
  "goat",
  "pig",
  "horse",
  "chicken",
  "other",
] as const;

export const AnimalCreateSchema = z.object({
  name: z.string().min(1).max(100),
  animal_type: z.enum(ANIMAL_TYPES),
  tag_number: z.string().max(50).optional().nullable(),
  breed: z.string().max(100).optional().nullable(),
  date_of_birth: isoDate.optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const AnimalUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  animal_type: z.enum(ANIMAL_TYPES).optional(),
  tag_number: z.string().max(50).optional().nullable(),
  breed: z.string().max(100).optional().nullable(),
  date_of_birth: isoDate.optional().nullable(),
  status: z.enum(["alive", "dead"]).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export const DeathRecordFormSchema = z.object({
  animal_id: z.coerce.number().int(),
  cause_of_death: z.string().min(1).max(200),
  date_of_death: isoDate,
  notes: z.string().max(1000).optional().nullable(),
});

/** Formats the first Zod issue as a single string, matching the shape our
 * jsonError()/{"detail": "<string>"} convention expects. */
export function firstZodError(
  result: z.SafeParseReturnType<unknown, unknown>,
): string {
  if (result.success) return "";
  const issue = result.error.issues[0];
  return issue
    ? `${issue.path.join(".")}: ${issue.message}`
    : "Invalid request";
}
