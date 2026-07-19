import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthSession = { userId: string; email: string };

/**
 * Locally verifies the request's Supabase JWT (no network round-trip in the common case —
 * see Supabase's `getClaims()` docs) rather than trusting unverified cookie contents.
 * Returns null if there is no valid session; never throws for "logged out".
 */
export async function getSession(): Promise<AuthSession | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const { sub, email } = data.claims;
  if (!sub || !email) return null;
  return { userId: sub, email };
}
