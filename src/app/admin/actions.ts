"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupportedLocale } from "@/i18n/routing";

/**
 * Signs the current admin out. Not gated by `requireRole` — logging out isn't a privileged
 * mutation (any signed-in admin, of any role, may end their own session), and it must still work
 * even if the caller's AdminUser row is inactive/missing, so it doesn't touch Prisma at all.
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

/**
 * Sets the shared `rabea_locale` cookie (see src/i18n/routing.ts) and re-renders the current
 * route. A Server Action that mutates cookies triggers Next.js's automatic re-render (see the
 * Next.js Server Actions guide, "Understanding cookie behavior in Server Functions"), so no
 * explicit `revalidatePath`/`redirect` is needed here.
 */
export async function setAdminLocaleAction(locale: SupportedLocale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("rabea_locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
