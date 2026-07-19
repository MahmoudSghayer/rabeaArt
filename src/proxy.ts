import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const PREVIEW_COOKIE = "rabea_preview";

/**
 * Pre-launch "coming soon" gate: in production EVERY page (storefront AND admin) rewrites to
 * /coming-soon, so no routes or content leak before release. Launch day: set COMING_SOON=0 in
 * the host's env (no code change). Team preview: set PREVIEW_KEY in the env, then visit any
 * URL with ?preview=<key> once — a cookie keeps the bypass for 30 days. Local development
 * (NODE_ENV !== production) is never gated.
 */
function comingSoonGate(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (process.env.COMING_SOON === "0") return null;

  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/coming-soon") return null;

  const previewKey = process.env.PREVIEW_KEY;
  if (previewKey) {
    if (searchParams.get("preview") === previewKey) {
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
    if (request.cookies.get(PREVIEW_COOKIE)?.value === previewKey) return null;
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
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
