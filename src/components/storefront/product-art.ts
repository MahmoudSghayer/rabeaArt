import { ARTS, grainedArt, type ArtKey } from "@/components/storefront/art";

/**
 * Calm, neutral gradient used whenever a slug or a stored art key doesn't resolve to a real
 * ARTS entry (e.g. a future product outside the seeded set, or corrupted localStorage data).
 */
const FALLBACK_ART_KEY: ArtKey = "still";

function isArtKey(value: string): value is ArtKey {
  return Object.prototype.hasOwnProperty.call(ARTS, value);
}

/** Validates an arbitrary string (e.g. read back from localStorage) against the ARTS keys. */
export function resolveArtKey(value: string | null | undefined): ArtKey {
  return value && isArtKey(value) ? value : FALLBACK_ART_KEY;
}

/**
 * Derives the placeholder-art gradient key from a product slug. Seed slugs follow
 * `sh-<key>` / `pa-<key>` (e.g. "sh-dawn", "pa-rivers" — see prisma/seed.ts), where `<key>` is
 * the part after the first dash and matches an ARTS gradient key 1:1. Falls back to a neutral
 * gradient for any slug that doesn't resolve, so products outside the current seed never break
 * card rendering once real photography/DB-backed images replace this placeholder system.
 */
export function artKeyForSlug(slug: string): ArtKey {
  const dash = slug.indexOf("-");
  const suffix = dash === -1 ? slug : slug.slice(dash + 1);
  return resolveArtKey(suffix);
}

/** Convenience wrapper: grained ARTS background for a product's card art, keyed off its slug. */
export function productArtBackground(slug: string): string {
  return grainedArt(artKeyForSlug(slug));
}
