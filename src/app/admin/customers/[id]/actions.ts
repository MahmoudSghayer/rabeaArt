"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";
import { requireRole, AuthError } from "@/lib/auth/requireRole";

/**
 * Mirrors the shape every order Server Action follows (see
 * `src/app/admin/orders/[id]/actions.ts`): `requireRole` first, zod-validate, mutation +
 * `AuditLog` row in one `prisma.$transaction`, typed `{ ok, error? }` result, `revalidatePath`.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

class CustomerActionError extends Error {
  constructor(public code: "NOT_FOUND") {
    super(code);
    this.name = "CustomerActionError";
  }
}

function toActionError(err: unknown, fallback: string): ActionResult {
  if (err instanceof AuthError) return { ok: false, error: "FORBIDDEN" };
  if (err instanceof CustomerActionError) return { ok: false, error: err.code };
  console.error(fallback, err);
  return { ok: false, error: fallback };
}

/** The whole textarea, not an append-only log (unlike order internal notes/CommunicationLog) —
 * this replaces `Customer.notes` wholesale. An empty string clears the field to `null`. Max
 * length matches the order note field's ceiling (`addInternalNoteAction`'s `noteSchema`). */
const notesSchema = z.string().trim().max(4000);

export async function updateCustomerNotesAction(customerId: string, notes: string): Promise<ActionResult> {
  const parsed = notesSchema.safeParse(notes);
  if (!parsed.success) return { ok: false, error: "INVALID_NOTES" };

  try {
    const admin = await requireRole(AdminRole.STAFF);

    await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true } });
      if (!customer) throw new CustomerActionError("NOT_FOUND");

      await tx.customer.update({ where: { id: customerId }, data: { notes: parsed.data || null } });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "customer.notes.update",
          targetType: "Customer",
          targetId: customerId,
          metadata: {},
        },
      });
    });

    revalidatePath(`/admin/customers/${customerId}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err, "NOTES_UPDATE_FAILED");
  }
}
