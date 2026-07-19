import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client bound to the current request's cookies (Server Components,
 * Server Actions, Route Handlers). Only handles auth/session — all data access goes through
 * Prisma (src/lib/prisma.ts), never through this client's Postgres access.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render (not an Action/Route Handler) — cookies
            // can't be written here. Harmless as long as proxy.ts refreshes the session on
            // navigation; see src/proxy.ts.
          }
        },
      },
    },
  );
}
