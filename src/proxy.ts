import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const PREVIEW_COOKIE = "rabea_preview";

/**
 * Public (unauthenticated) API routes. These accept writes from anonymous callers, so while the
 * coming-soon gate is up they must be refused too — see comingSoonGate. Admin API routes are
 * deliberately NOT listed: they gate themselves via requireRole() and staying reachable is what
 * lets the back office be used during a pre-launch preview.
 */
const PUBLIC_API_PREFIXES = ["/api/orders", "/api/uploads"];

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Constant-time string comparison. The preview key is a shared secret, and `===` on strings
 * short-circuits at the first differing byte, which leaks the length of the matching prefix to
 * anyone able to time the response. Edge runtime has no node:crypto.timingSafeEqual, so this is
 * the equivalent accumulate-the-difference loop over the full length of both inputs.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Pre-launch "coming soon" gate: in production EVERY page (storefront AND admin) rewrites to
 * /coming-soon, so no routes or content leak before release. Launch day: set COMING_SOON=0 in
 * the host's env (no code change). Team preview: set PREVIEW_KEY in the env, then visit any
 * URL with ?preview=<key> once — a cookie keeps the bypass for 30 days. Local development
 * (NODE_ENV !== production) is never gated.
 *
 * Public API routes are refused with 503 rather than rewritten: a rewrite would hand an HTML
 * page to a fetch() caller. Before this, /api/orders and /api/uploads/* were reachable from the
 * internet while every page said "coming soon", so anyone who guessed the path could write rows
 * into the production orders/customers tables.
 */
function comingSoonGate(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (process.env.COMING_SOON === "0") return null;

  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/coming-soon") return null;

  const previewKey = process.env.PREVIEW_KEY;
  if (previewKey) {
    const supplied = searchParams.get("preview");
    if (supplied && safeEqual(supplied, previewKey)) {
      const url = request.nextUrl.clone();
      url.searchParams.delete("preview");
      const response = NextResponse.redirect(url);
      response.cookies.set(PREVIEW_COOKIE, previewKey, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
      return response;
    }
    const cookie = request.cookies.get(PREVIEW_COOKIE)?.value;
    if (cookie && safeEqual(cookie, previewKey)) return null;
  }

  // JSON, not a rewrite: API callers must get a machine-readable refusal.
  if (isPublicApiPath(pathname)) {
    return NextResponse.json(
      { error: "SERVICE_UNAVAILABLE" },
      { status: 503, headers: { "Retry-After": "3600" } },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/coming-soon";
  url.search = "";
  return NextResponse.rewrite(url);
}

/**
 * Coarse gate only: "is there a valid session". Fine-grained role authorization happens in
 * requireRole() (Node runtime, Prisma-backed) at the top of every admin Server Action / Route
 * Handler — see src/lib/auth/requireRole.ts. Admin routes are NOT locale-prefixed.
 */
async function handleAdminGate(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);
  const isLoginPage = request.nextUrl.pathname === "/admin/login";

  if (!isLoggedIn && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (isLoggedIn && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const gated = comingSoonGate(request);
  if (gated) return gated;

  // API routes are matched ONLY so the coming-soon gate above can refuse them. Past that point
  // they must pass straight through — locale negotiation would rewrite the path and break them.
  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }
  // /coming-soon lives outside the [locale] tree — serve it directly, no intl handling.
  if (request.nextUrl.pathname === "/coming-soon") {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return handleAdminGate(request);
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    // Public API routes: matched so the coming-soon gate can refuse them pre-launch. Admin API
    // routes stay unmatched — they self-gate with requireRole() and must work during preview.
    "/api/orders/:path*",
    "/api/uploads/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
