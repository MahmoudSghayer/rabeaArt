import "server-only";
import { redirect } from "next/navigation";
import { AdminRole } from "@/generated/prisma/enums";
import type { AdminUserModel } from "@/generated/prisma/models";
import { requireRole, AuthError } from "@/lib/auth/requireRole";

/**
 * Server Component page guard. `src/proxy.ts` only checks "is there a session" before letting a
 * request reach `/admin/**`; this is the defense-in-depth check for a Server Component page
 * (Overview, Orders list, Order detail, …) that its session still resolves to an active
 * AdminUser row with at least `min`'s role — redirecting to login rather than throwing turns an
 * edge case (session cookie present but the row was deactivated/deleted) into a clean re-login
 * instead of a 500.
 */
export async function requireAdminPage(min: AdminRole = AdminRole.STAFF): Promise<AdminUserModel> {
  try {
    return await requireRole(min);
  } catch (err) {
    if (err instanceof AuthError) redirect("/admin/login");
    throw err;
  }
}
