import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS and can call `auth.admin.*` (invite/ban/delete
 * users). NEVER import this outside server-only code paths (Server Actions/Route Handlers
 * gated by requireRole). The `server-only` import makes any accidental client-bundle
 * inclusion a build error instead of a leaked secret.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
