import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  validateUpload,
} from "@/lib/storage/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSignedOrderUploadUrl } from "@/lib/storage/uploads";

/** Talks to Storage and Postgres — must not run on the Edge runtime. */
export const runtime = "nodejs";

const bodySchema = z.object({
  draftId: z.uuid(),
  filename: z.string().min(1).max(200),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  // Spread to a mutable array: z.enum's typing wants a non-readonly tuple even though the
  // allowlist itself (see lib/storage/validation) is intentionally declared `as const`.
  mimeType: z.enum([...ALLOWED_UPLOAD_MIME]),
  existingCount: z.number().int().min(0).max(MAX_UPLOAD_FILES),
});

/** Best-effort client IP for rate-limit keying; falls back to a shared bucket if unavailable
 * (fails toward "rate limited together" rather than "unlimited"). */
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
    const rateLimit = await checkRateLimit({ key: `upload-sign:${ip}`, limit: 30, windowSeconds: 600 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_FILE" }, { status: 400 });
    }
    const { draftId, filename, size, mimeType, existingCount } = parsed.data;

    if (existingCount >= MAX_UPLOAD_FILES) {
      return NextResponse.json({ code: "TOO_MANY_FILES" }, { status: 400 });
    }

    const validation = validateUpload({ mimeType, size, filename });
    if (!validation.ok) {
      return NextResponse.json({ code: "INVALID_FILE" }, { status: 400 });
    }

    const { path, token, signedUrl } = await createSignedOrderUploadUrl({ draftId, filename });
    return NextResponse.json({ path, token, signedUrl });
  } catch (err) {
    console.error("POST /api/uploads/sign failed", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
