import "server-only";
import { redirect } from "next/navigation";
import { AdminRole } from "@/generated/prisma/enums";
import type { AdminUserModel } from "@/generated/prisma/models";
import { requireRole, AuthError } from "@/lib/auth/requireRole";

/**
 * Server Component page guard. `src/proxy.ts` only checks "is there a session" before letting a
 * request reach `/admin/**`; this is the defense-in-depth check for a Server Component page
 * (Overview, Orders list, Order detail, …) that its session still resolves to an active
 * AdminUser row with at least `min`'s role.
 *
 * The 401/403 split is load-bearing, not tidiness:
 *
 *   401 UNAUTHENTICATED — no session. Sending them to the login page is correct: they log in and
 *   continue.
 *
 *   403 FORBIDDEN — the session is VALID, but it resolves to no AdminUser row, an inactive one,
 *   or one whose role is too low. Sending *this* to the login page creates an infinite redirect
 *   loop: proxy.ts sees a logged-in user on /admin/login and bounces them straight back to
 *   /admin, which throws 403 again. The browser spins forever on alternating 200/307s and the
 *   admin appears to hang on a blank page with no error anywhere.
 *
 * So 403 goes to a dedicated dead-end page that states the actual problem and offers a way out.
 * That page must never call this guard, or the loop simply moves.
 */
export async function requireAdminPage(min: AdminRole = AdminRole.STAFF): Promise<AdminUserModel> {
  try {
    return await requireRole(min);
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(err.status === 401 ? "/admin/login" : "/admin/no-access");
    }
    throw err;
  }
}
