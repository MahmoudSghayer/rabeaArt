import "server-only";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { AdminRole } from "@/generated/prisma/enums";
import type { AdminUserModel } from "@/generated/prisma/models";

export class AuthError extends Error {
  status: 401 | 403;
  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

const roleRank: Record<AdminRole, number> = {
  [AdminRole.STAFF]: 0,
  [AdminRole.ADMIN]: 1,
  [AdminRole.OWNER]: 2,
};

/**
 * The real authorization boundary for every admin Server Action / Route Handler — proxy.ts
 * only checks "is there a session" (see src/proxy.ts). Hiding a button in the UI is not
 * authorization; every mutation must call this first.
 */
export async function requireRole(min: AdminRole): Promise<AdminUserModel> {
  const session = await getSession();
  if (!session) throw new AuthError(401, "UNAUTHENTICATED");

  const admin = await prisma.adminUser.findUnique({ where: { id: session.userId } });
  if (!admin || !admin.active) throw new AuthError(403, "FORBIDDEN");
  if (roleRank[admin.role] < roleRank[min]) throw new AuthError(403, "FORBIDDEN");

  return admin;
}

/** Use when a route only needs "is logged in", with no minimum role. */
export async function requireAdmin(): Promise<AdminUserModel> {
  return requireRole(AdminRole.STAFF);
}
