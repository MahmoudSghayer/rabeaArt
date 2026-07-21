import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SUPPORTED_LOCALES, routing } from "@/i18n/routing";

/**
 * There was no sitemap (audit SEO-01), so every product had to be discovered by link-following
 * with no `lastmod` signal.
 *
 * Two details this has to get right:
 *
 *  - `localePrefix: "as-needed"` means Arabic (the default) has NO prefix and English lives at
 *    /en. Emitting /ar/... would produce a sitemap full of URLs that redirect.
 *  - Both locales are real, indexable pages of the same content, so each entry carries
 *    `alternates.languages`. Without it the two locales compete as duplicate content.
 */

/** Storefront routes with no dynamic segment. `/order` is deliberately absent — it is a cart
 * checkout step, useless to a crawler landing on it cold. */
const STATIC_PATHS = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/shop", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/custom", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/legal/terms", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/legal/privacy", priority: 0.2, changeFrequency: "yearly" as const },
];

/**
 * Rebuilt at most hourly rather than pinned at build time: products are added through the admin,
 * and a statically-baked sitemap would keep advertising the catalog as it looked on the last
 * deploy. Hourly is far below crawler re-fetch rates, so the DB query is effectively free.
 */
export const revalidate = 3600;

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://rabea.art").replace(/\/$/, "");
}

/** Locale-prefixed path, honouring `localePrefix: "as-needed"`. */
function localized(base: string, locale: string, path: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  const url = `${base}${prefix}${path}`;
  // Trailing-slash-free, except the root which must keep its slash.
  return url === base ? `${base}/` : url;
}

function alternatesFor(base: string, path: string): Record<string, string> {
  return Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, localized(base, l, path)]));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.flatMap(
    ({ path, priority, changeFrequency }) =>
      SUPPORTED_LOCALES.map((locale) => ({
        url: localized(base, locale, path),
        changeFrequency,
        priority,
        alternates: { languages: alternatesFor(base, path) },
      })),
  );

  // Slug + updatedAt only. Deliberately NOT listProducts(), which pulls a four-deep include of
  // images/colors/sizes/variants that a sitemap has no use for (see audit PERF-01).
  let products: Array<{ slug: string; updatedAt: Date }> = [];
  try {
    products = await prisma.product.findMany({
      where: { archived: false },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });
  } catch {
    // A sitemap is not worth failing a build or a request over — CI builds run with no
    // DATABASE_URL at all (see .github/workflows/ci.yml), and a transient outage should degrade
    // to the static routes rather than 500.
    products = [];
  }

  const productEntries: MetadataRoute.Sitemap = products.flatMap((p) =>
    SUPPORTED_LOCALES.map((locale) => ({
      url: localized(base, locale, `/product/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: { languages: alternatesFor(base, `/product/${p.slug}`) },
    })),
  );

  return [...staticEntries, ...productEntries];
}
