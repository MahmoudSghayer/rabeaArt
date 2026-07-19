import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES } from "@/lib/storage/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { ORDER_UPLOADS_BUCKET, getObjectMetadata, removeObject } from "@/lib/storage/uploads";

/** Talks to Storage and Postgres — must not run on the Edge runtime. */
export const runtime = "nodejs";

const bodySchema = z.object({
  draftId: z.uuid(),
  path: z.string().min(1).max(300),
});

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rateLimit = await checkRateLimit({ key: `upload-verify:${ip}`, limit: 60, windowSeconds: 600 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_PATH" }, { status: 400 });
    }
    const { draftId, path } = parsed.data;

    // The client only ever learns its own draftId-scoped paths from /api/uploads/sign, so a
    // mismatch here means either a bug or someone probing another draft's staged files.
    if (!path.startsWith(`${draftId}/`)) {
      return NextResponse.json({ code: "INVALID_PATH" }, { status: 400 });
    }

    // Metadata comes from Storage, never from the request body — the whole point of this
    // endpoint is to verify what was actually uploaded, not to trust the client's claims.
    const metadata = await getObjectMetadata(ORDER_UPLOADS_BUCKET, path);
    if (!metadata) {
      return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
    }

    const mimeIsAllowed = (ALLOWED_UPLOAD_MIME as readonly string[]).includes(metadata.mimeType);
    if (metadata.size > MAX_UPLOAD_BYTES || !mimeIsAllowed) {
      await removeObject(ORDER_UPLOADS_BUCKET, path);
      return NextResponse.json({ code: "REJECTED" }, { status: 422 });
    }

    return NextResponse.json({ ok: true, size: metadata.size, mimeType: metadata.mimeType });
  } catch (err) {
    console.error("POST /api/uploads/verify failed", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
