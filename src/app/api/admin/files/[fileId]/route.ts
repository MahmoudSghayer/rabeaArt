import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";
import { requireRole, AuthError } from "@/lib/auth/requireRole";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createSignedDownloadUrl,
  fromOrderUploadsBucketPath,
  ORDER_UPLOADS_BUCKET,
} from "@/lib/storage/uploads";

/** Talks to Postgres and Supabase Storage — must not run on the Edge runtime. */
export const runtime = "nodejs";

/** Signed URLs are single-use-ish view links for an admin clicking a file chip — keep them
 * short-lived; the admin can always click again. */
const DOWNLOAD_URL_TTL_SECONDS = 120;

/**
 * GET /api/admin/files/[fileId] — redirects to a short-lived signed download URL for a customer
 * order attachment (private `order-uploads` bucket). `requireRole(STAFF)` is the authorization
 * boundary: proxy.ts only checks "logged in", and these are private customer files.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  try {
    const admin = await requireRole(AdminRole.STAFF);

    // RL-03: file views are frequent when browsing an order's attachments, so this cap is high —
    // it exists only to stop a scripted enumeration of signed download URLs, not normal use.
    const rl = await checkRateLimit({ key: `admin-file:${admin.id}`, limit: 120, windowSeconds: 600 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "600" } });
    }

    const { fileId } = await ctx.params;
    const file = await prisma.orderFile.findUnique({ where: { id: fileId } });
    if (!file) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // OrderFile.bucketPath stores the FULL "order-uploads/..." form; the Storage SDK wants the
    // bucket-relative path — see the CANONICAL bucketPath FORMAT comment in lib/storage/uploads.
    const path = fromOrderUploadsBucketPath(file.bucketPath);
    const signedUrl = await createSignedDownloadUrl(ORDER_UPLOADS_BUCKET, path, DOWNLOAD_URL_TTL_SECONDS);

    return NextResponse.redirect(signedUrl, { status: 307 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/admin/files/[fileId] failed", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
