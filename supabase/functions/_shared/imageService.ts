// Port of backend/app/services/image_service.py.
//
// KNOWN, DELIBERATE SCOPE-NARROWING (flagged in the migration plan, not
// silent): the Python version authoritatively validates images by asking
// Pillow to fully decode and verify() the compressed stream — catching
// truncated/corrupted payloads that merely have a valid header. There is no
// equivalent full-decode library that runs cleanly in the Deno Edge Runtime
// under this timeline, so this uses magic-byte (file signature) sniffing via
// `file-type` instead. It still defeats the "rename evil.html to photo.jpg"
// attack (the client's Content-Type/filename is never trusted — the stored
// key and content-type are derived from the *detected* signature), but a
// file with a valid header and corrupted body would pass here where Pillow
// would reject it. Real exploitability is low: the bucket is private,
// objects are only ever served via short-lived signed URLs, and the
// extension is server-derived, never the client's. File a follow-up for a
// proper decode-based check post-launch.
import { fileTypeFromBuffer } from "file-type";
import { getDb } from "./db.ts";
import { saveObject } from "./storageService.ts";

export const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}
export class DuplicateImageError extends Error {
  constructor() {
    super("This image has already been used in a previous death report");
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function imageHashExists(
  farmId: number,
  imageHash: string,
): Promise<boolean> {
  const sql = getDb();
  const [row] = await sql<{ id: number }[]>`
    select id from death_records where farm_id = ${farmId} and image_hash = ${imageHash}
  `;
  return !!row;
}

export async function processDeathImage(
  declaredContentType: string,
  contents: Uint8Array,
  farmId: number,
  // Optional injection point for tests: defaults to the real storage save so
  // every existing/production caller (no 5th arg) is unaffected.
  saveFn: typeof saveObject = saveObject,
): Promise<{ imageRef: string; imageHash: string }> {
  if (!ALLOWED_CONTENT_TYPES.has(declaredContentType)) {
    throw new ImageValidationError(
      `Unsupported image type '${declaredContentType}'. ` +
        `Allowed: ${[...ALLOWED_CONTENT_TYPES].sort().join(", ")}`,
    );
  }

  if (contents.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new ImageValidationError(
      "Image exceeds maximum allowed size of 10 MB",
    );
  }

  const detected = await fileTypeFromBuffer(contents);
  if (!detected || !ALLOWED_CONTENT_TYPES.has(detected.mime)) {
    throw new ImageValidationError(
      `Unsupported image format '${detected?.mime ?? "unknown"}'. ` +
        "Allowed: JPEG, PNG, WEBP, GIF",
    );
  }
  const ext = EXT_MAP[detected.mime];

  const imageHash = await sha256Hex(contents);

  if (await imageHashExists(farmId, imageHash)) {
    throw new DuplicateImageError();
  }

  // Key is fully server-derived (farm scope + content hash + detected
  // format) — the client filename is deliberately discarded.
  const key = `${farmId}/${imageHash}.${ext}`;
  const imageRef = await saveFn(key, contents, detected.mime);
  return { imageRef, imageHash };
}
