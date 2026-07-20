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

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
