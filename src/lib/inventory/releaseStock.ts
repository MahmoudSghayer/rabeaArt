import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { aggregateQtyByVariant } from "./decide";

/**
 * Reverses `applyStock`'s deduction, INSIDE the caller's transaction. Idempotent by design: only
 * acts if `Order.stockAppliedAt` is currently set, and always clears it afterwards — calling this
 * on an order whose stock was never applied (or already released) is a safe no-op, which matters
 * because `stockActionForTransition` (lib/orders/transitions.ts) can be evaluated repeatedly for
 * the same order as an admin moves it between statuses.
 */
export async function releaseStock(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { stockAppliedAt: true } });
  if (!order?.stockAppliedAt) return;

  const items = await tx.orderItem.findMany({
    where: { orderId, variantId: { not: null } },
    select: {
      variantId: true,
      qty: true,
      variant: { select: { product: { select: { trackStock: true } } } },
    },
  });

  const trackedItems = items.filter(
    (item): item is typeof item & { variantId: string } =>
      item.variantId !== null && item.variant !== null && item.variant.product.trackStock,
  );

  const releasedByVariant = aggregateQtyByVariant(
    trackedItems.map((item) => ({ variantId: item.variantId, qty: item.qty })),
  );

  for (const [variantId, qty] of releasedByVariant) {
    await tx.productVariant.update({ where: { id: variantId }, data: { stock: { increment: qty } } });
  }

  await tx.order.update({ where: { id: orderId }, data: { stockAppliedAt: null } });
}
