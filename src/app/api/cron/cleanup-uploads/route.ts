import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { log, requestIdFrom } from "@/lib/log";
import { ORDER_UPLOADS_BUCKET, PRODUCT_IMAGES_BUCKET } from "@/lib/storage/buckets";
import {
  listObjectsUnder,
  listTopLevelPrefixes,
  removeObject,
  toOrderUploadsBucketPath,
} from "@/lib/storage/uploads";

/** Talks to Storage and Postgres — must not run on the Edge runtime. */
export const runtime = "nodejs";

/** A staged upload is only eligible for cleanup once it's been sitting long enough that a
 * genuine in-progress checkout couldn't still be using it (see repo cleanup-rule doc). */
const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;
/** Caps deletions per invocation so a large backlog can't blow through a serverless function's
 * time budget — safe because the job is idempotent and simply picks up where it left off on the
 * next scheduled run. */
const MAX_DELETIONS_PER_RUN = 500;

/** Constant-time comparison of the caller-supplied secret against `CRON_SECRET`. Accepts either
 * our own `x-cron-secret` header (manual/pg_cron/GitHub Actions callers) or Vercel Cron's
 * convention (`Authorization: Bearer <CRON_SECRET>`, sent on its GET requests). Length is
 * checked first because `timingSafeEqual` throws (rather than returning false) on a length
 * mismatch, and comparing lengths up front leaks nothing an attacker doesn't already know
 * (secret length isn't the secret). */
function isAuthorized(request: NextRequest): boolean {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const provided = request.headers.get("x-cron-secret") ?? bearer;
  const expected = process.env.CRON_SECRET;
  if (!provided || !expected) return false;

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Deletes staged `order-uploads` objects older than 24h with no matching `OrderFile` row.
 * "scanned" counts objects that were old enough to be orphan-eligible and were checked against
 * the DB; "deleted" counts how many of those were actually removed. Safe to call repeatedly —
 * an object already deleted (or since claimed by a submitted order) is simply skipped.
 */
/**
 * Describes how to sweep one bucket: how a storage object key maps to the value recorded in the
 * database, and how to ask the database which of a batch of keys are claimed.
 */
interface BucketSweep {
  bucket: string;
  /** Storage object key -> the value stored in the owning table's column. */
  toDbKey: (objectPath: string) => string;
  /** Given candidate DB keys, return the subset that some row claims. ONE query per batch. */
  findClaimed: (dbKeys: string[]) => Promise<Set<string>>;
}

const SWEEPS: BucketSweep[] = [
  {
    // Customer reference photos. OrderFile.bucketPath stores the FULL "order-uploads/..." form.
    bucket: ORDER_UPLOADS_BUCKET,
    toDbKey: toOrderUploadsBucketPath,
    findClaimed: async (dbKeys) => {
      const rows = await prisma.orderFile.findMany({
        where: { bucketPath: { in: dbKeys } },
        select: { bucketPath: true },
      });
      return new Set(rows.map((r) => r.bucketPath));
    },
  },
  {
    // Admin product photos. ProductImage.path is bucket-RELATIVE (see productImageUrl.ts), so
    // the storage key and the DB value are the same string — no conversion.
    //
    // This bucket previously had no cleanup at all: an admin who uploaded photos and then
    // navigated away without saving left objects recorded in no row, which nothing would ever
    // collect. A permanent, unbounded storage leak (audit DB-04).
    bucket: PRODUCT_IMAGES_BUCKET,
    toDbKey: (objectPath) => objectPath,
    findClaimed: async (dbKeys) => {
      const rows = await prisma.productImage.findMany({
        where: { path: { in: dbKeys } },
        select: { path: true },
      });
      return new Set(rows.map((r) => r.path));
    },
  },
];

/**
 * Sweeps one bucket. Returns how many objects were old enough to check, and how many were
 * actually removed.
 *
 * The ownership check is batched per prefix. It used to be one `findFirst` per object, which
 * meant the cost scaled with the number of files RETAINED rather than the number of orphans
 * deleted — every legitimately-owned file was re-queried on every nightly run, forever, against
 * an unindexed column (audit DB-05). Both halves are now fixed: this issues one query per
 * prefix, and `bucketPath`/`path` are indexed.
 */
async function sweepBucket(sweep: BucketSweep, budget: () => number): Promise<{ scanned: number; deleted: number }> {
  const cutoff = Date.now() - ORPHAN_AGE_MS;
  let scanned = 0;
  let deleted = 0;

  const prefixes = await listTopLevelPrefixes(sweep.bucket);

  for (const prefix of prefixes) {
    if (budget() <= 0) break;

    const entries = await listObjectsUnder(sweep.bucket, prefix);

    // Age-filter first, so the DB is only asked about objects that are actually candidates.
    const candidates = entries.filter((entry) => {
      if (!entry.createdAt) return false;
      const createdAtMs = new Date(entry.createdAt).getTime();
      return !Number.isNaN(createdAtMs) && createdAtMs <= cutoff;
    });
    if (candidates.length === 0) continue;

    scanned += candidates.length;

    const claimed = await sweep.findClaimed(candidates.map((c) => sweep.toDbKey(c.path)));

    for (const entry of candidates) {
      if (budget() <= 0) break;
      if (claimed.has(sweep.toDbKey(entry.path))) continue;

      try {
        await removeObject(sweep.bucket, entry.path);
        deleted += 1;
      } catch (err) {
        // Leave it for the next run rather than letting one bad object abort the whole pass.
        log.warn("cleanup: failed to remove orphan", {
          event: "cron.cleanup.remove_failed",
          bucket: sweep.bucket,
          path: entry.path,
          error: err,
        });
      }
    }
  }

  return { scanned, deleted };
}

async function cleanupOrphanedUploads(): Promise<{
  scanned: number;
  deleted: number;
  buckets: Record<string, { scanned: number; deleted: number }>;
}> {
  let deletedTotal = 0;
  let scannedTotal = 0;
  const buckets: Record<string, { scanned: number; deleted: number }> = {};

  // One deletion budget shared across both buckets — the cap exists to protect the function's
  // time limit, which is a per-invocation resource, not a per-bucket one.
  const budget = () => MAX_DELETIONS_PER_RUN - deletedTotal;

  for (const sweep of SWEEPS) {
    const result = await sweepBucket(sweep, budget);
    buckets[sweep.bucket] = result;
    scannedTotal += result.scanned;
    deletedTotal += result.deleted;
  }

  return { scanned: scannedTotal, deleted: deletedTotal, buckets };
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const requestId = requestIdFrom(request.headers);
  const startedAt = Date.now();

  try {
    const result = await cleanupOrphanedUploads();
    const durationMs = Date.now() - startedAt;

    // Logged on SUCCESS too, deliberately. A nightly job that quietly stops doing anything looks
    // identical to one that has nothing to do; the only way to tell them apart later is a run
    // record. `hitCap` is the signal that a backlog is outgrowing one invocation.
    log.info("cleanup-uploads completed", {
      event: "cron.cleanup.completed",
      requestId,
      durationMs,
      scanned: result.scanned,
      deleted: result.deleted,
      buckets: result.buckets,
      hitCap: result.deleted >= MAX_DELETIONS_PER_RUN,
    });

    return NextResponse.json({ ...result, durationMs });
  } catch (err) {
    log.error("cleanup-uploads failed", {
      event: "cron.cleanup.failed",
      requestId,
      durationMs: Date.now() - startedAt,
      error: err,
    });
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}

/** Vercel Cron invokes scheduled routes with GET (+ Authorization: Bearer CRON_SECRET). */
export async function GET(request: NextRequest) {
  return handle(request);
}
