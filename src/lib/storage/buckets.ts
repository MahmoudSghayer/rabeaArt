/**
 * Storage bucket names, kept in their own module with NO `server-only` marker and no Supabase
 * client import. Client components legitimately need the bucket name to build public image URLs
 * (see components/admin/products/productImageUrl.ts); importing it from `uploads.ts` would drag
 * the service-role admin client into the browser bundle graph, which Next.js rightly refuses to
 * build. Values must match the buckets created in Supabase (docs/SETUP-DATABASE.md).
 */

/** Private — customer reference images, reachable only through short-lived signed URLs. */
export const ORDER_UPLOADS_BUCKET = "order-uploads";

/** Public — product photos, served through the CDN/image optimizer. */
export const PRODUCT_IMAGES_BUCKET = "product-images";
