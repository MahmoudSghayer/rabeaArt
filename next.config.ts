import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Baseline security headers. Vercel already serves HSTS; these cover the rest of the standard
 * set. A full Content-Security-Policy is deliberately not set here — Next injects inline
 * bootstrap scripts, so a strict policy needs per-request nonces via middleware, which is a
 * larger change than it looks and easy to get subtly wrong. Worth doing, tracked separately.
 */
const SECURITY_HEADERS = [
  // The site is never meant to be framed; blocks clickjacking of the admin in particular.
  { key: "X-Frame-Options", value: "DENY" },
  // Stops browsers guessing a different content type than we send (e.g. treating an upload as HTML).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full order/admin URLs (which can carry refs) to third-party sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs these devices; deny by default.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

/**
 * Pin the image optimizer to THIS Supabase project only.
 *
 * A wildcard (`*.supabase.co`) would accept any Supabase tenant on the internet, which turns
 * /_next/image into an open image proxy: anyone can push arbitrary third-party images through
 * our optimizer, on our bill and into our cache. Derived from NEXT_PUBLIC_SUPABASE_URL so it
 * follows the project automatically; falls back to the wildcard only when that var is absent
 * (CI builds run without real env — see .github/workflows/ci.yml).
 */
function supabaseImageHostname(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "*.supabase.co";
  try {
    return new URL(raw).hostname;
  } catch {
    return "*.supabase.co";
  }
}

const nextConfig: NextConfig = {
  // Don't advertise the framework/version; it's free reconnaissance for an attacker.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHostname(),
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
