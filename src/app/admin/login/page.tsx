import { getAdminLocale } from "../_lib/messages";
import { LoginScreen } from "./LoginScreen";

/**
 * Real Supabase Auth sign-in form (see LoginForm.tsx for the client form + Supabase call, and
 * src/proxy.ts for the `?next=` param it's fed — proxy.ts redirects unauthenticated `/admin/**`
 * requests here with the originally-requested path).
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  // Only ever redirect back into the admin app itself — never trust an arbitrary external/absolute
  // `next` value (open-redirect guard), and never loop back to the login page itself.
  const next = rawNext && rawNext.startsWith("/admin") && rawNext !== "/admin/login" ? rawNext : "/admin";

  const locale = await getAdminLocale();
  const storeHref = locale === "en" ? "/en" : "/";

  return <LoginScreen next={next} storeHref={storeHref} />;
}
