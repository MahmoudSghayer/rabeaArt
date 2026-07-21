/**
 * Cache tags for the storefront's catalog reads.
 *
 * Kept in their own module, with no imports, so that BOTH sides can use them: the query layer
 * that attaches them (catalog/cached.ts) and the admin Server Actions that invalidate them
 * (admin/**\/actions.ts). A tag written as a bare string in two places is a tag that will
 * eventually be misspelled in one of them, and a misspelled invalidation tag fails silently —
 * the cache simply never clears and the storefront serves stale data indefinitely.
 */

export const CATALOG_TAGS = {
  /** Any product data: the shop list, featured products, product detail. */
  products: "catalog:products",
  /** Option lookups — sizes, colours, frames, materials, production methods. */
  options: "catalog:options",
  /** The settings singleton: WhatsApp number, contact email, announcement banner. */
  settings: "catalog:settings",
} as const;

/** Per-product tag, so editing one product doesn't dump every other product's cache. */
export function productTag(slug: string): string {
  return `catalog:product:${slug}`;
}
