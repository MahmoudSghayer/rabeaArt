/**
 * Upload constraints and pure validators for order-attachment uploads (reference photos,
 * logos, etc.). Used by the upload API routes (not implemented here) to reject bad files
 * before anything touches storage.
 */

export const MAX_UPLOAD_FILES = 6;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * SVG is deliberately excluded from allowed image types: an SVG can embed `<script>` or
 * event-handler attributes that execute when the file is opened/previewed as an "image" in a
 * browser context (e.g. an admin opening an uploaded file directly) — treat it as executable
 * content, not a safe raster image.
 */
export const ALLOWED_UPLOAD_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_UPLOAD_EXT = ["jpg", "jpeg", "png", "webp"] as const;

export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIME)[number];
export type AllowedUploadExt = (typeof ALLOWED_UPLOAD_EXT)[number];

export type UploadValidationResult = { ok: true } | { ok: false; reason: "type" | "size" | "ext" };

/** Lowercases and strips the leading dot from a filename's extension; null if there isn't one. */
function extensionOf(filename: string): string | null {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename);
  return match ? match[1].toLowerCase() : null;
}

function isAllowedMime(value: string): value is AllowedUploadMime {
  return (ALLOWED_UPLOAD_MIME as readonly string[]).includes(value);
}

function isAllowedExt(value: string): value is AllowedUploadExt {
  return (ALLOWED_UPLOAD_EXT as readonly string[]).includes(value);
}

/**
 * Validates a single upload against the MIME allowlist, extension allowlist, and size cap.
 * Checks are independent (a mismatched-but-individually-valid mime/ext pair, e.g. a
 * mislabelled `.png` sent as `image/jpeg`, is not treated as fraud here — that's a job for
 * server-side content sniffing later in the pipeline, not this pure validator).
 */
export function validateUpload(input: {
  mimeType: string;
  size: number;
  filename: string;
}): UploadValidationResult {
  if (!isAllowedMime(input.mimeType)) {
    return { ok: false, reason: "type" };
  }
  const ext = extensionOf(input.filename);
  if (!ext || !isAllowedExt(ext)) {
    return { ok: false, reason: "ext" };
  }
  if (input.size <= 0 || input.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "size" };
  }
  return { ok: true };
}

/**
 * Builds a random, non-guessable object storage key. The extension is derived from the
 * original filename ONLY if it's in the allowlist — anything else (or a missing extension)
 * falls back to a generic "bin" extension rather than propagating untrusted input into the
 * storage key.
 */
export function randomObjectKey(prefix: string, filename: string): string {
  const ext = extensionOf(filename);
  const safeExt = ext && isAllowedExt(ext) ? ext : "bin";
  return `${prefix}/${crypto.randomUUID()}.${safeExt}`;
}
