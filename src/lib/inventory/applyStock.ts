import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { aggregateQtyByVariant, findShortVariantIds } from "./decide";
import { InventoryError, type StockShortfall } from "./errors";

/**
 * Deducts stock for an order's variant-backed items, INSIDE the caller's transaction. Only
 * SHIRT-kind items carry a `variantId` (paintings and custom items never do — see
 * OrderItem.variantId in prisma/schema.prisma and src/lib/orders/submit.ts), and stock is only
 * meaningfully tracked for products that opted in via `Product.trackStock` — a product that never
 * turned stock tracking on always reports `stock: 0`, so it must never be treated as "out of
 * stock" here.
 *
 * Call this only when transitioning an order INTO ACCEPTED (see stockActionForTransition in
 * lib/orders/transitions.ts) and only when `stockApplied` is currently false — the caller is
 * responsible for that idempotency check via `Order.stockAppliedAt`; this function itself does
 * not re-read `stockAppliedAt`, so calling it twice would double-decrement.
 *
 * STOCK-ACCEPT RULE: re-checks live stock at accept time (not the stale `stockWarning` flag set
 * at submission) and throws `InventoryError` — which aborts the whole `$transaction` — if any
 * variant is short. No partial/force-accept in this wave.
 */
export async function applyStock(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const items = await tx.orderItem.findMany({
    where: { orderId, variantId: { not: null } },
    select: {
      variantId: true,
      qty: true,
      variant: {
        select: {
          id: true,
          stock: true,
          product: { select: { trackStock: true, nameAr: true, nameEn: true } },
          color: { select: { nameAr: true, nameEn: true } },
          size: { select: { labelAr: true, labelEn: true } },
        },
      },
    },
  });

  const trackedItems = items.filter(
    (item): item is typeof item & { variantId: string; variant: NonNullable<(typeof item)["variant"]> } =>
      item.variantId !== null && item.variant !== null && item.variant.product.trackStock,
  );
  if (trackedItems.length === 0) return;

  const neededByVariant = aggregateQtyByVariant(
    trackedItems.map((item) => ({ variantId: item.variantId, qty: item.qty })),
  );
  const stockByVariant = new Map(trackedItems.map((item) => [item.variantId, item.variant.stock]));

  const shortVariantIds = findShortVariantIds(neededByVariant, stockByVariant);
  if (shortVariantIds.length > 0) {
    const byVariantId = new Map(trackedItems.map((item) => [item.variantId, item.variant]));
    const shortfalls: StockShortfall[] = shortVariantIds.map((variantId) => {
      const variant = byVariantId.get(variantId);
      const productName = variant ? (variant.product.nameEn || variant.product.nameAr) : variantId;
      const colorName = variant?.color ? variant.color.nameEn || variant.color.nameAr : null;
      const sizeLabel = variant?.size ? variant.size.labelEn || variant.size.labelAr : null;
      const variantDetail = [colorName, sizeLabel].filter(Boolean).join(" / ");
      return {
        variantId,
        label: variantDetail ? `${productName} (${variantDetail})` : productName,
        needed: neededByVariant.get(variantId) ?? 0,
        available: stockByVariant.get(variantId) ?? 0,
      };
    });
    throw new InventoryError(shortfalls);
  }

  for (const [variantId, qty] of neededByVariant) {
    await tx.productVariant.update({ where: { id: variantId }, data: { stock: { decrement: qty } } });
  }

  await tx.order.update({ where: { id: orderId }, data: { stockAppliedAt: new Date() } });
}
