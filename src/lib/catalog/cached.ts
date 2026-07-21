import "server-only";
import { unstable_cache } from "next/cache";
import { CATALOG_TAGS, productTag } from "./cache-tags";
import {
  getFeaturedProducts,
  getProductBySlug,
  getSettings,
  listActiveOptions,
} from "./queries";
import type {
  CatalogActiveOptions,
  CatalogListItem,
  CatalogProductDetail,
  CatalogSettings,
} from "./types";

/**
 * Cached wrappers around the catalog reads (audit CACHE-01).
 *
 * The storefront had no caching of any kind, so every anonymous visit re-ran the full catalog
 * query, five option lookups and a settings read — for data that changes when an admin edits a
 * product, i.e. rarely. Meanwhile ~30 `revalidatePath` calls already existed across the admin
 * actions with nothing cached for them to invalidate.
 *
 * `unstable_cache` rather than the `use cache` directive: `use cache` is a Cache Components
 * feature requiring `cacheComponents: true` in next.config.ts, which changes rendering semantics
 * app-wide. That is a far larger blast radius than this optimisation justifies, and this app is
 * mid-flight with a second workstream in the tree. `unstable_cache` is the documented path for
 * projects not on Cache Components (see the "Caching and Revalidating (Previous Model)" guide in
 * the installed Next docs) and is scoped to exactly these four functions.
 *
 * Both a tag AND a time bound are set on each. Tags handle the correctness case (an admin edits
 * a product; the change must show immediately). `revalidate` is the safety net for the case tags
 * cannot cover — a row changed directly in the Supabase SQL editor, which is how this project is
 * routinely administered and which fires no `revalidateTag` at all.
 *
 * NOT cached here: `listProducts` (the /shop listing). It takes filter/sort/pagination
 * arguments, so caching it means a cache entry per filter combination, and it is the query the
 * audit flagged as unbounded (PERF-01). Bounding it in SQL comes first; caching it afterwards.
 */

const HOUR = 3600;

/** Homepage featured strip. */
export const getCachedFeaturedProducts = unstable_cache(
  async (limit: number): Promise<CatalogListItem[]> => getFeaturedProducts(limit),
  ["catalog-featured"],
  { tags: [CATALOG_TAGS.products], revalidate: HOUR },
);

/**
 * Product detail. Tagged per-slug as well as globally, so editing one product does not dump
 * every other product's cache entry.
 *
 * `null` (unknown slug) is cached too — that is deliberate. An unknown slug is most often a
 * crawler or a stale link, and those repeat; caching the miss stops each one costing a query.
 */
export const getCachedProductBySlug = unstable_cache(
  async (slug: string): Promise<CatalogProductDetail | null> => getProductBySlug(slug),
  ["catalog-product"],
  { tags: [CATALOG_TAGS.products], revalidate: HOUR },
);

/** Shop filters and the custom-order wizard. Five queries behind one entry. */
export const getCachedActiveOptions = unstable_cache(
  async (): Promise<CatalogActiveOptions> => listActiveOptions(),
  ["catalog-options"],
  { tags: [CATALOG_TAGS.options], revalidate: HOUR },
);

/**
 * Settings singleton — WhatsApp number, contact email, announcement banner. Read on nearly every
 * storefront render, and changes perhaps monthly.
 */
export const getCachedSettings = unstable_cache(
  async (): Promise<CatalogSettings> => getSettings(),
  ["catalog-settings"],
  { tags: [CATALOG_TAGS.settings], revalidate: HOUR },
);

export { CATALOG_TAGS, productTag };
