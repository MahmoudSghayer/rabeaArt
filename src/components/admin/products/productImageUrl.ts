import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage/buckets";

/**
 * Deterministic public URL for an object in the public "product-images" bucket. This is pure
 * string construction — identical to what the Supabase SDK's `storage.from(bucket).getPublicUrl()`
 * computes (no signing, no network call) — reproduced here so both Server Components (grid cards,
 * the edit form's initial images) and this client form (fresh uploads) can build it without
 * instantiating a Supabase client. Safe to call with an empty env var at build time; it only
 * matters once actually rendered.
 */
export function productImagePublicUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${path}`;
}
