import "server-only";
import { StorageApiError } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { randomObjectKey } from "@/lib/storage/validation";

/**
 * Server-only Supabase Storage helpers for the two app buckets.
 *
 * CANONICAL bucketPath FORMAT (read this before touching OrderFile.bucketPath anywhere):
 * Every function in this module (except the `toOrderUploadsBucketPath`/`fromOrderUploadsBucketPath`
 * pair below) takes/returns BUCKET-RELATIVE paths — e.g. `"3fa8.../f47ac10b-....jpg"` — because
 * that's what the Supabase SDK's `.storage.from(bucket)` API expects once a bucket is already
 * selected. The `OrderFile.bucketPath` column, however, stores the FULL path INCLUDING the
 * bucket name as a prefix — e.g. `"order-uploads/3fa8.../f47ac10b-....jpg"` — because the order
 * schemas validate it with `bucketPath.startsWith("order-uploads/")`. Any code that reads/writes
 * `OrderFile.bucketPath` (the order-submission flow, the cleanup cron) MUST convert between the
 * two forms with `toOrderUploadsBucketPath` / `fromOrderUploadsBucketPath` — never hand-roll the
 * `"order-uploads/" + path` concatenation elsewhere, so this is the single place the convention
 * can change.
 */

export const ORDER_UPLOADS_BUCKET = "order-uploads";
export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Files are listed in pages of this size when walking a bucket (cron / admin listings). */
const LIST_PAGE_SIZE = 1000;
/** Hard cap on how many entries a single `listObjectsUnder`/`listTopLevelPrefixes` call will
 * walk, so a pathological bucket can't turn a cron invocation into an unbounded loop. */
const LIST_MAX_ITEMS = 10_000;

export type StorageErrorCode =
  | "SIGN_FAILED"
  | "METADATA_FAILED"
  | "REMOVE_FAILED"
  | "DOWNLOAD_SIGN_FAILED"
  | "LIST_FAILED"
  | "INVALID_PATH";

/** Typed wrapper around Supabase Storage SDK errors — the SDK returns `{data, error}` pairs
 * rather than throwing, so every function here converts a non-null `error` into one of these
 * with a machine-readable `code` callers can branch on without string-matching messages. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "StorageError";
    this.code = code;
  }
}

/** Converts a bucket-relative `order-uploads` path to the full form stored in `OrderFile.bucketPath`. */
export function toOrderUploadsBucketPath(path: string): string {
  return `${ORDER_UPLOADS_BUCKET}/${path}`;
}

/** Inverse of {@link toOrderUploadsBucketPath}. Throws if `bucketPath` isn't in the expected bucket. */
export function fromOrderUploadsBucketPath(bucketPath: string): string {
  const prefix = `${ORDER_UPLOADS_BUCKET}/`;
  if (!bucketPath.startsWith(prefix)) {
    throw new StorageError(
      "INVALID_PATH",
      `bucketPath "${bucketPath}" does not start with "${prefix}"`,
    );
  }
  return bucketPath.slice(prefix.length);
}

/** Best-effort check for "object doesn't exist" storage errors, used to turn a 404 into `null`
 * instead of a thrown StorageError (missing is an expected, normal outcome for metadata lookups). */
function isNotFoundError(error: unknown): boolean {
  if (error instanceof StorageApiError) {
    if (error.status === 404) return true;
    if (typeof error.statusCode === "string" && error.statusCode === "404") return true;
  }
  return false;
}

/**
 * Requests a signed upload URL for a customer reference file staged under a checkout draft.
 * The object key is random and non-guessable (see `randomObjectKey`); the draft's own id is the
 * only structure in the path, so orphan cleanup can group objects by draft.
 */
export async function createSignedOrderUploadUrl(opts: {
  draftId: string;
  filename: string;
}): Promise<{ path: string; token: string; signedUrl: string }> {
  const path = randomObjectKey(opts.draftId, opts.filename);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(ORDER_UPLOADS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    throw new StorageError("SIGN_FAILED", `Failed to create a signed upload URL for "${path}"`, error);
  }
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export type ObjectMetadata = {
  size: number;
  mimeType: string;
  /** ISO 8601 creation timestamp, as reported by Storage. */
  createdAt: string;
};

/** Fetches real, server-verified metadata for a single object — never trust client-supplied
 * size/mimeType for anything security-relevant (see /api/uploads/verify). Returns `null` if the
 * object doesn't exist (or is missing size/content-type, which shouldn't happen for a real
 * upload but is treated the same as "not usable"). */
export async function getObjectMetadata(bucket: string, path: string): Promise<ObjectMetadata | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).info(path);
  if (error) {
    if (isNotFoundError(error)) return null;
    throw new StorageError("METADATA_FAILED", `Failed to read metadata for "${path}"`, error);
  }
  if (!data || data.size == null || !data.contentType) return null;
  return { size: data.size, mimeType: data.contentType, createdAt: data.createdAt };
}

/** Deletes a single object. Throws on any error other than "already gone" (deleting a
 * already-deleted object is treated as success — callers like the cleanup cron must be safe to
 * retry). */
export async function removeObject(bucket: string, path: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error && !isNotFoundError(error)) {
    throw new StorageError("REMOVE_FAILED", `Failed to remove "${path}"`, error);
  }
}

/** Signs a short-lived download URL for a private-bucket object (e.g. an admin viewing a
 * customer reference photo). Defaults to 60 seconds — callers needing longer should pass it
 * explicitly rather than relying on a long-lived default. */
export async function createSignedDownloadUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 60,
): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new StorageError(
      "DOWNLOAD_SIGN_FAILED",
      `Failed to create a signed download URL for "${path}"`,
      error,
    );
  }
  return data.signedUrl;
}

export type StorageListEntry = {
  /** File name only (no path). */
  name: string;
  /** Bucket-relative path, i.e. `${prefix}/${name}`. */
  path: string;
  size: number;
  mimeType: string | null;
  /** ISO 8601 creation timestamp, or null if Storage didn't report one (folder placeholders). */
  createdAt: string | null;
};

/**
 * Lists every FILE object under a prefix (one level — Storage's `list()` is per-folder, not
 * recursive; `order-uploads` only ever nests one level deep, `{draftId}/{uuid}.{ext}`, so that's
 * sufficient here). Paginates via limit/offset and stops at `LIST_MAX_ITEMS` as a safety cap.
 */
export async function listObjectsUnder(bucket: string, prefix: string): Promise<StorageListEntry[]> {
  const supabase = createSupabaseAdminClient();
  const results: StorageListEntry[] = [];
  let offset = 0;

  while (results.length < LIST_MAX_ITEMS) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: LIST_PAGE_SIZE,
      offset,
    });
    if (error) {
      throw new StorageError("LIST_FAILED", `Failed to list objects under "${prefix}"`, error);
    }
    if (!data || data.length === 0) break;

    for (const item of data) {
      // Folder entries report a null id — this function only returns files.
      if (item.id === null) continue;
      results.push({
        name: item.name,
        path: prefix ? `${prefix}/${item.name}` : item.name,
        size: item.metadata?.size ?? 0,
        mimeType: item.metadata?.mimetype ?? null,
        createdAt: item.created_at,
      });
    }

    if (data.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }

  return results;
}

/**
 * Lists the top-level "folder" entries of a bucket (for `order-uploads`, these are draftIds).
 * Supabase Storage has no real folders — a "folder" is just a common object-name prefix that the
 * list API reports as an entry with a null id — so this is really "distinct first path segments".
 */
export async function listTopLevelPrefixes(bucket: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const prefixes: string[] = [];
  let offset = 0;

  while (prefixes.length < LIST_MAX_ITEMS) {
    const { data, error } = await supabase.storage.from(bucket).list("", {
      limit: LIST_PAGE_SIZE,
      offset,
    });
    if (error) {
      throw new StorageError("LIST_FAILED", `Failed to list top-level prefixes in "${bucket}"`, error);
    }
    if (!data || data.length === 0) break;

    for (const item of data) {
      if (item.id === null) prefixes.push(item.name);
    }

    if (data.length < LIST_PAGE_SIZE) break;
    offset += LIST_PAGE_SIZE;
  }

  return prefixes;
}
