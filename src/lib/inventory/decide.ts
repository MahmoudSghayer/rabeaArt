/**
 * Pure, DB-free decision helpers for the stock apply/release lifecycle (see applyStock.ts /
 * releaseStock.ts). Kept separate so the aggregation/shortfall math is unit-testable without a
 * database — the two callers only add the Prisma read/write around these.
 */

export interface QtyByVariant {
  variantId: string;
  qty: number;
}

/**
 * Sums `qty` per `variantId`. An order can (in principle) carry more than one line item for the
 * same variant — e.g. two custom notes on the same colour/size — so every stock check/mutation
 * must work against the aggregated total, not check each line item in isolation (which could let
 * a combined-over-stock order slip through one line at a time).
 */
export function aggregateQtyByVariant(items: QtyByVariant[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const { variantId, qty } of items) {
    totals.set(variantId, (totals.get(variantId) ?? 0) + qty);
  }
  return totals;
}

/**
 * Given the aggregated qty needed per variant and the current stock level per variant, returns
 * the variantIds that don't have enough stock. Any variant missing from `stockByVariant` is
 * treated as having 0 available (defensive — should not happen since callers read stock and qty
 * from the same query).
 */
export function findShortVariantIds(
  neededByVariant: Map<string, number>,
  stockByVariant: Map<string, number>,
): string[] {
  const short: string[] = [];
  for (const [variantId, needed] of neededByVariant) {
    const available = stockByVariant.get(variantId) ?? 0;
    if (needed > available) short.push(variantId);
  }
  return short;
}
