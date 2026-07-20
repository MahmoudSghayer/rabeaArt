"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";
import { requireRole, AuthError } from "@/lib/auth/requireRole";
import { settingsFormSchema } from "./schema";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toActionError(err: unknown, fallback: string): ActionResult {
  if (err instanceof AuthError) return { ok: false, error: "FORBIDDEN" };
  console.error(fallback, err);
  return { ok: false, error: fallback };
}

/** Upserts the Settings singleton (id=1 — see prisma/schema.prisma). Storefront chrome (WhatsApp
 * link, announcement bar) reads this via `getSettings()` in src/lib/catalog/queries.ts, so both
 * the admin page and the public site are revalidated. */
export async function saveSettingsAction(raw: unknown): Promise<ActionResult> {
  const parsed = settingsFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const input = parsed.data;

  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const data = {
        whatsapp: input.whatsapp,
        email: input.email,
        instagram: input.instagram || null,
        announcementAr: input.announcementAr || null,
        announcementEn: input.announcementEn || null,
        announcementActive: input.announcementActive,
        customOtherEnabled: input.customOtherEnabled,
      };
      await tx.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "settings.update", targetType: "Settings", targetId: "1", metadata: {} },
      });
    });
    revalidatePath("/admin/settings");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "SETTINGS_SAVE_FAILED");
  }
}
