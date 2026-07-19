import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ORDER_UPLOADS_BUCKET,
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

/** Constant-time comparison of the `x-cron-secret` header against `CRON_SECRET`. Length is
 * checked first because `timingSafeEqual` throws (rather than returning false) on a length
 * mismatch, and comparing lengths up front leaks nothing an attacker doesn't already know
 * (secret length isn't the secret). */
function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get("x-cron-secret");
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
async function cleanupOrphanedUploads(): Promise<{ scanned: number; deleted: number }> {
  const cutoff = Date.now() - ORPHAN_AGE_MS;
  let scanned = 0;
  let deleted = 0;

  const prefixes = await listTopLevelPrefixes(ORDER_UPLOADS_BUCKET);

  for (const prefix of prefixes) {
    if (deleted >= MAX_DELETIONS_PER_RUN) break;

    const entries = await listObjectsUnder(ORDER_UPLOADS_BUCKET, prefix);
    for (const entry of entries) {
      if (deleted >= MAX_DELETIONS_PER_RUN) break;
      if (!entry.createdAt) continue;

      const createdAtMs = new Date(entry.createdAt).getTime();
      if (Number.isNaN(createdAtMs) || createdAtMs > cutoff) continue;

      scanned += 1;
      const bucketPath = toOrderUploadsBucketPath(entry.path);
      const owned = await prisma.orderFile.findFirst({
        where: { bucketPath },
        select: { id: true },
      });
      if (owned) continue;

      try {
        await removeObject(ORDER_UPLOADS_BUCKET, entry.path);
        deleted += 1;
      } catch (err) {
        // Leave it for the next run rather than letting one bad object abort the whole pass.
        console.error(`cleanup-uploads: failed to remove orphan "${bucketPath}"`, err);
      }
    }
  }

  return { scanned, deleted };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await cleanupOrphanedUploads();
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/cron/cleanup-uploads failed", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
