import type { MetadataRoute } from "next";

/**
 * There was no robots.txt at all (audit SEO-01), which means crawlers applied their own
 * defaults — including to /admin.
 *
 * The pre-launch gate is respected deliberately: while COMING_SOON is on, every page rewrites to
 * /coming-soon (which already sets `robots: noindex`), so inviting crawlers in would only get
 * the holding page indexed under the real URLs. Serving a blanket disallow until launch avoids
 * teaching Google that rabea.art is a one-page "coming soon" site — a first impression that
 * outlives the gate itself.
 */
/**
 * Evaluated per request, not at build time. `COMING_SOON` is read at runtime by src/proxy.ts, so
 * a build-time robots.txt would desync the moment you flip the env var in Vercel without
 * redeploying: the site would open to visitors while robots.txt still said `Disallow: /`, and
 * the launch would be invisible to search engines until someone noticed. A two-line text file is
 * not worth caching.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rabea.art";
  const gated = process.env.NODE_ENV === "production" && process.env.COMING_SOON !== "0";

  if (gated) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /admin is session-gated and would 307 to the login page anyway; /api serves no
        // human-readable content. Excluding both keeps crawl budget on the storefront.
        disallow: ["/admin", "/admin/", "/api/", "/coming-soon"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
