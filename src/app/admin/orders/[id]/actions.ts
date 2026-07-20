"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AdminRole, ContactMethod, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { requireRole, AuthError } from "@/lib/auth/requireRole";
import { isValidTransition, stockActionForTransition } from "@/lib/orders/transitions";
import { applyStock, releaseStock, InventoryError } from "@/lib/inventory";
import { sendOrderNotification } from "@/lib/email/notify";
import type { EmailTemplate } from "@/lib/email/types";
import { getSettings } from "@/lib/catalog/queries";

/** Status transitions that notify the customer by email (see lib/email/templates.ts). */
const STATUS_EMAIL_TEMPLATES: Partial<Record<OrderStatus, EmailTemplate>> = {
  [OrderStatus.QUOTED]: "quotation-sent",
  [OrderStatus.ACCEPTED]: "order-accepted",
  [OrderStatus.DECLINED]: "order-declined",
  [OrderStatus.READY]: "order-ready",
};

/**
 * Fire-and-forget, called AFTER the status transaction commits: an email-provider call must
 * never sit inside a DB transaction, and a mail failure must never roll back or fail the
 * status change. sendOrderNotification itself never throws and logs every attempt to EmailLog.
 */
async function dispatchStatusEmail(orderId: string, template: EmailTemplate): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        ref: true,
        locale: true,
        estTotal: true,
        finalPrice: true,
        customer: { select: { name: true, email: true } },
      },
    });
    if (!order?.customer.email) return;
    const settings = await getSettings();
    await sendOrderNotification({
      template,
      to: order.customer.email,
      locale: order.locale === "en" ? "en" : "ar",
      orderId,
      data: {
        customerName: order.customer.name,
        orderRef: order.ref,
        estTotal: order.estTotal !== null ? Number(order.estTotal) : null,
        finalPrice: order.finalPrice !== null ? Number(order.finalPrice) : null,
        whatsapp: settings.whatsapp,
      },
    });
  } catch (err) {
    console.error("status email dispatch failed", err);
  }
}

/**
 * Every mutation below follows the same shape (see project conventions): `requireRole` first,
 * zod-validate the input, do the mutation + its `AuditLog` row inside one `prisma.$transaction`,
 * return a typed `{ ok, error? }` rather than throwing across the server/client boundary, and
 * `revalidatePath` the pages that show the changed data.
 */
export type ActionResult = { ok: true } | { ok: false; error: string; details?: string };

class OrderActionError extends Error {
  constructor(public code: "NOT_FOUND") {
    super(code);
    this.name = "OrderActionError";
  }
}

function toActionError(err: unknown, fallback: string): ActionResult {
  if (err instanceof AuthError) return { ok: false, error: "FORBIDDEN" };
  if (err instanceof OrderActionError) return { ok: false, error: err.code };
  if (err instanceof InventoryError) {
    return { ok: false, error: "STOCK_SHORTAGE", details: err.message };
  }
  console.error(fallback, err);
  return { ok: false, error: fallback };
}

const statusSchema = z.enum(Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]]);
const paySchema = z.enum(Object.values(PaymentStatus) as [PaymentStatus, ...PaymentStatus[]]);

/**
 * `AdminRole.STAFF` — the matrix's floor role may update order status/pay/notes/communication
 * (see project plan's role matrix).
 */
export async function updateOrderStatusAction(orderId: string, nextStatusRaw: OrderStatus): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(nextStatusRaw);
  if (!parsed.success) return { ok: false, error: "INVALID_STATUS" };
  const nextStatus = parsed.data;

  try {
    const admin = await requireRole(AdminRole.STAFF);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, stockAppliedAt: true },
      });
      if (!order) throw new OrderActionError("NOT_FOUND");
      if (!isValidTransition(order.status, nextStatus)) {
        throw new Error("INVALID_TRANSITION");
      }

      const stockAction = stockActionForTransition({
        from: order.status,
        to: nextStatus,
        stockApplied: Boolean(order.stockAppliedAt),
      });
      // STOCK-ACCEPT RULE: applyStock re-checks live stock and throws InventoryError (aborting
      // this whole transaction — no partial accept) if any variant is short.
      if (stockAction === "apply") await applyStock(tx, orderId);
      if (stockAction === "release") await releaseStock(tx, orderId);

      await tx.order.update({ where: { id: orderId }, data: { status: nextStatus } });
      await tx.orderStatusHistory.create({
        data: { orderId, status: nextStatus, byAdminId: admin.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "order.status.update",
          targetType: "Order",
          targetId: orderId,
          metadata: { from: order.status, to: nextStatus },
        },
      });

    });

    // Post-commit customer notification for QUOTED/ACCEPTED/DECLINED/READY (see map above).
    const emailTemplate = STATUS_EMAIL_TEMPLATES[nextStatus];
    if (emailTemplate) void dispatchStatusEmail(orderId, emailTemplate);

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_TRANSITION") {
      return { ok: false, error: "INVALID_TRANSITION" };
    }
    return toActionError(err, "TRANSITION_FAILED");
  }
}

export async function updateOrderPayAction(orderId: string, nextPayRaw: PaymentStatus): Promise<ActionResult> {
  const parsed = paySchema.safeParse(nextPayRaw);
  if (!parsed.success) return { ok: false, error: "INVALID_PAY" };
  const nextPay = parsed.data;

  try {
    const admin = await requireRole(AdminRole.STAFF);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { pay: true } });
      if (!order) throw new OrderActionError("NOT_FOUND");

      await tx.order.update({ where: { id: orderId }, data: { pay: nextPay } });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "order.pay.update",
          targetType: "Order",
          targetId: orderId,
          metadata: { from: order.pay, to: nextPay },
        },
      });
    });

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "PAY_UPDATE_FAILED");
  }
}

const finalPriceSchema = z.number().finite().nonnegative().max(1_000_000).nullable();

export async function updateFinalPriceAction(orderId: string, price: number | null): Promise<ActionResult> {
  const parsed = finalPriceSchema.safeParse(price);
  if (!parsed.success) return { ok: false, error: "INVALID_PRICE" };
  const finalPrice = parsed.data;

  try {
    const admin = await requireRole(AdminRole.STAFF);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (!order) throw new OrderActionError("NOT_FOUND");

      await tx.order.update({ where: { id: orderId }, data: { finalPrice } });
      const note = finalPrice === null ? "Final price cleared" : `Final price set: ₪${finalPrice}`;
      await tx.orderStatusHistory.create({
        data: { orderId, status: order.status, note, byAdminId: admin.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "order.finalPrice.update",
          targetType: "Order",
          targetId: orderId,
          metadata: { finalPrice },
        },
      });
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err, "PRICE_UPDATE_FAILED");
  }
}

const etaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export async function updateEtaAction(orderId: string, etaDate: string | null): Promise<ActionResult> {
  const parsed = etaSchema.safeParse(etaDate);
  if (!parsed.success) return { ok: false, error: "INVALID_DATE" };
  const eta = parsed.data ? new Date(`${parsed.data}T00:00:00.000Z`) : null;
  if (eta && Number.isNaN(eta.getTime())) return { ok: false, error: "INVALID_DATE" };

  try {
    const admin = await requireRole(AdminRole.STAFF);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!order) throw new OrderActionError("NOT_FOUND");

      await tx.order.update({ where: { id: orderId }, data: { eta } });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "order.eta.update",
          targetType: "Order",
          targetId: orderId,
          metadata: { eta: eta ? eta.toISOString() : null },
        },
      });
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err, "ETA_UPDATE_FAILED");
  }
}

export async function setOrderArchivedAction(orderId: string, archived: boolean): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.STAFF);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!order) throw new OrderActionError("NOT_FOUND");

      await tx.order.update({ where: { id: orderId }, data: { archived } });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: archived ? "order.archive" : "order.unarchive",
          targetType: "Order",
          targetId: orderId,
          metadata: {},
        },
      });
    });

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "ARCHIVE_UPDATE_FAILED");
  }
}

const noteSchema = z.string().trim().min(1).max(2000);

export async function addInternalNoteAction(orderId: string, text: string): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(text);
  if (!parsed.success) return { ok: false, error: "INVALID_NOTE" };

  try {
    const admin = await requireRole(AdminRole.STAFF);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!order) throw new OrderActionError("NOT_FOUND");

      await tx.communicationLog.create({
        data: { orderId, channel: ContactMethod.INTERNAL, text: parsed.data, byAdminId: admin.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "order.note.internal.add",
          targetType: "Order",
          targetId: orderId,
          metadata: {},
        },
      });
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err, "NOTE_ADD_FAILED");
  }
}

const waTextSchema = z.string().trim().min(1).max(2000);

/** Records that a WhatsApp message was sent from the composer — this app never sends WhatsApp
 * messages itself (there's no WhatsApp Business API integration), it only logs that the admin
 * opened `wa.me` with the drafted text and clicked "record as sent". */
export async function recordWhatsappSentAction(orderId: string, text: string): Promise<ActionResult> {
  const parsed = waTextSchema.safeParse(text);
  if (!parsed.success) return { ok: false, error: "INVALID_TEXT" };

  try {
    const admin = await requireRole(AdminRole.STAFF);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
      if (!order) throw new OrderActionError("NOT_FOUND");

      await tx.communicationLog.create({
        data: { orderId, channel: ContactMethod.WHATSAPP, text: parsed.data, byAdminId: admin.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "order.communication.whatsapp.record",
          targetType: "Order",
          targetId: orderId,
          metadata: {},
        },
      });
    });

    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (err) {
    return toActionError(err, "WA_RECORD_FAILED");
  }
}
