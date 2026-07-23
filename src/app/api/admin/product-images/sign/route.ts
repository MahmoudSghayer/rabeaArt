import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AdminRole } from "@/generated/prisma/enums";
import { requireRole, AuthError } from "@/lib/auth/requireRole";
import { checkRateLimit } from "@/lib/rate-limit";
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES, validateUpload, randomObjectKey } from "@/lib/storage/validation";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage/uploads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Talks to Storage — must not run on the Edge runtime. */
export const runtime = "nodejs";

/** A product carries at most this many photos (see ProductForm's ImagesField). */
const MAX_PRODUCT_IMAGES = 6;

const bodySchema = z.object({
  // Groups objects under a draft/product id for tidy storage paths — a product cuid, or a
  // crypto.randomUUID() draft id for a not-yet-created product (see ProductForm). API-04: constrain
  // to a safe charset so it can never inject path separators into the storage key — cuid, uuid and
  // the draft ids all match [A-Za-z0-9_-], while "/" "." ".." are rejected.
  productId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  filename: z.string().min(1).max(200),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  // Spread to a mutable array: z.enum's typing wants a non-readonly tuple even though the
  // allowlist itself (see lib/storage/validation) is intentionally declared `as const`.
  mimeType: z.enum([...ALLOWED_UPLOAD_MIME]),
  existingCount: z.number().int().min(0).max(MAX_PRODUCT_IMAGES),
});

/**
 * Signed-upload endpoint for product photos, mirroring the shape of `/api/uploads/sign` (see
 * that file) but scoped to admins and the "product-images" bucket. Unlike the public
 * order-upload pipeline, there's no separate `/verify` step: this route is only reachable by an
 * authenticated ADMIN-role session (not an anonymous storefront visitor), so the trust boundary
 * that the verify step exists to enforce doesn't apply here — the signed URL itself is the only
 * thing that can write to the object, and `validateUpload` already rejects bad type/size/ext
 * before a URL is even issued.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole(AdminRole.ADMIN);

    // RL-03: mints signed upload URLs — cap per admin so a compromised session can't spray the
    // bucket with upload grants.
    const rl = await checkRateLimit({ key: `admin-image-sign:${admin.id}`, limit: 30, windowSeconds: 600 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "600" } });
    }

    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_FILE" }, { status: 400 });
    }
    const { productId, filename, size, mimeType, existingCount } = parsed.data;

    if (existingCount >= MAX_PRODUCT_IMAGES) {
      return NextResponse.json({ code: "TOO_MANY_FILES" }, { status: 400 });
    }

    const validation = validateUpload({ mimeType, size, filename });
    if (!validation.ok) {
      return NextResponse.json({ code: "INVALID_FILE" }, { status: 400 });
    }

    const path = randomObjectKey(productId, filename);
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ error: "SIGN_FAILED" }, { status: 500 });
    }

    return NextResponse.json({ path: data.path, token: data.token, signedUrl: data.signedUrl });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: err.status });
    }
    console.error("POST /api/admin/product-images/sign failed", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
