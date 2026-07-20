"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { requireRole, AuthError } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Same shape every admin Server Action follows (see `orders/[id]/actions.ts`): `requireRole`
 * first, zod-validate, mutation + `AuditLog` in one `prisma.$transaction`, typed result,
 * `revalidatePath`. Every action here is `requireRole(OWNER)` — admin-user management is
 * OWNER-only per the role matrix (see AGENTS.md / `admin/users/page.tsx`). */
export type ActionResult = { ok: true } | { ok: false; error: string };

class UserActionError extends Error {
  constructor(public code: "NOT_FOUND" | "LAST_OWNER" | "INVITE_FAILED" | "EMAIL_TAKEN") {
    super(code);
    this.name = "UserActionError";
  }
}

function toActionError(err: unknown, fallback: string): ActionResult {
  if (err instanceof AuthError) return { ok: false, error: "FORBIDDEN" };
  if (err instanceof UserActionError) return { ok: false, error: err.code };
  console.error(fallback, err);
  return { ok: false, error: fallback };
}

/** `updateUserById({ ban_duration })` takes a duration string, not a boolean — Supabase has no
 * "ban forever" sentinel, so this uses a ~100-year duration as the de-facto equivalent. `"none"`
 * lifts a ban. This is defense-in-depth alongside `AdminUser.active` (the real enforcement point
 * — see `requireRole` in `lib/auth/requireRole.ts`, which checks `admin.active` on every request):
 * banning also stops the user from completing a fresh Supabase login at all. */
const BAN_FOREVER = "876000h";
const UNBAN = "none";

const ROLE_VALUES = Object.values(AdminRole) as [AdminRole, ...AdminRole[]];

/**
 * Counts ACTIVE owners within `tx` and throws `LAST_OWNER` if `wouldRemoveOwner` and the count is
 * already at the floor of 1 — the invariant AGENTS.md requires: "reject any role-change/
 * deactivation that would leave zero active OWNERs (count check inside the same transaction)".
 * Called from inside the same `$transaction` as the actual mutation so the count can't go stale
 * between the check and the write (no separate read-then-write race).
 */
async function assertOwnerFloorNotBroken(
  tx: Prisma.TransactionClient,
  wouldRemoveOwner: boolean,
): Promise<void> {
  if (!wouldRemoveOwner) return;
  const activeOwners = await tx.adminUser.count({ where: { role: AdminRole.OWNER, active: true } });
  if (activeOwners <= 1) throw new UserActionError("LAST_OWNER");
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(1).max(200),
  role: z.enum(ROLE_VALUES),
});

/**
 * Invites a new admin: `auth.admin.inviteUserByEmail` (Supabase emails them a sign-in link) then
 * a Prisma `AdminUser` row using the returned auth user id as the primary key (see schema.prisma:
 * `AdminUser.id` = Supabase `auth.users.id`). If the Prisma write fails (e.g. the email is
 * already taken by a soft-deleted-in-spirit row, or a DB hiccup), the Supabase invite is
 * compensated with `auth.admin.deleteUser` so a half-invited account doesn't linger — the two
 * systems can't share one transaction, so this is a manual saga rather than atomic.
 */
export async function inviteAdminUserAction(input: { email: string; name: string; role: AdminRole }): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { email, name, role } = parsed.data;

  try {
    const admin = await requireRole(AdminRole.OWNER);

    const existing = await prisma.adminUser.findUnique({ where: { email }, select: { id: true } });
    if (existing) return { ok: false, error: "EMAIL_TAKEN" };

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
    if (error || !data?.user) {
      console.error("inviteAdminUserAction: Supabase invite failed", error);
      return { ok: false, error: "INVITE_FAILED" };
    }
    const newUserId = data.user.id;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.adminUser.create({ data: { id: newUserId, email, name, role, active: true } });
        await tx.auditLog.create({
          data: { actorId: admin.id, action: "user.invite", targetType: "AdminUser", targetId: newUserId, metadata: { email, role } },
        });
      });
    } catch (dbErr) {
      await supabase.auth.admin.deleteUser(newUserId).catch((cleanupErr: unknown) => {
        console.error("inviteAdminUserAction: compensating deleteUser failed", cleanupErr);
      });
      throw dbErr;
    }

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "INVITE_FAILED");
  }
}

const roleSchema = z.enum(ROLE_VALUES);

export async function changeAdminRoleAction(userId: string, nextRoleRaw: AdminRole): Promise<ActionResult> {
  const parsed = roleSchema.safeParse(nextRoleRaw);
  if (!parsed.success) return { ok: false, error: "INVALID_ROLE" };
  const nextRole = parsed.data;

  try {
    const admin = await requireRole(AdminRole.OWNER);

    await prisma.$transaction(async (tx) => {
      const target = await tx.adminUser.findUnique({ where: { id: userId }, select: { role: true, active: true } });
      if (!target) throw new UserActionError("NOT_FOUND");

      const wouldRemoveOwner = target.role === AdminRole.OWNER && target.active && nextRole !== AdminRole.OWNER;
      await assertOwnerFloorNotBroken(tx, wouldRemoveOwner);

      await tx.adminUser.update({ where: { id: userId }, data: { role: nextRole } });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "user.role.change",
          targetType: "AdminUser",
          targetId: userId,
          metadata: { from: target.role, to: nextRole },
        },
      });
    });

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "ROLE_CHANGE_FAILED");
  }
}

export async function setAdminUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.OWNER);

    await prisma.$transaction(async (tx) => {
      const target = await tx.adminUser.findUnique({ where: { id: userId }, select: { role: true, active: true } });
      if (!target) throw new UserActionError("NOT_FOUND");

      const wouldRemoveOwner = !active && target.role === AdminRole.OWNER && target.active;
      await assertOwnerFloorNotBroken(tx, wouldRemoveOwner);

      await tx.adminUser.update({ where: { id: userId }, data: { active } });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: active ? "user.reactivate" : "user.deactivate",
          targetType: "AdminUser",
          targetId: userId,
          metadata: {},
        },
      });
    });

    // Best-effort Supabase ban/unban AFTER the transaction commits — an external auth-provider
    // call must never sit inside a DB transaction (same rule `dispatchStatusEmail` follows in
    // `orders/[id]/actions.ts`), and its failure must never roll back or fail the DB change:
    // `AdminUser.active` (checked by every `requireRole` call) is the real enforcement boundary.
    try {
      const supabase = createSupabaseAdminClient();
      await supabase.auth.admin.updateUserById(userId, { ban_duration: active ? UNBAN : BAN_FOREVER });
    } catch (banErr) {
      console.error("setAdminUserActiveAction: Supabase ban update failed", banErr);
    }

    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "ACTIVE_UPDATE_FAILED");
  }
}
