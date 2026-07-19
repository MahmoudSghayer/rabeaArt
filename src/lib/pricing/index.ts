/**
 * Pure pricing math — no Prisma imports, no side effects. Callers convert Prisma `Decimal`
 * fields to plain numbers at the DB boundary before calling into this module (and back to
 * `Decimal` before persisting), so the logic here stays trivially testable.
 *
 * Ports the math from the original design prototype (`_design-reference/store.js`):
 * `shirtPrice`, `paintingPrice`, `cartTotals`, and the estimate rule inside `submitOrder`.
 */

/** Shirt unit price: the sale price wins over the base price when one is set. */
export function shirtUnitPrice(p: { price: number; sale: number | null }): number {
  return p.sale ?? p.price;
}

/** Painting unit price: the size's base price plus the selected frame's add-on. */
export function paintingUnitPrice(sizePrice: number, frameAdd: number): number {
  return sizePrice + frameAdd;
}

export interface CartTotals {
  /** Sum of unitPrice * qty over all items that have a fixed price. */
  est: number;
  /** Count of ITEMS (not qty) that are manually priced (unitPrice === null). */
  manual: number;
  /** Sum of qty across every item, priced or manual. */
  count: number;
}

export interface CartTotalsItem {
  /** null means "manual pricing" — admin quotes this item after review. */
  unitPrice: number | null;
  qty: number;
}

/**
 * Port of store.js `cartTotals`. An item with `unitPrice === null` is manually priced: it's
 * excluded from `est` and counted once (regardless of qty) in `manual`. `count` always sums
 * qty, so it reflects the true number of pieces in the cart/order.
 */
export function cartTotals(items: CartTotalsItem[]): CartTotals {
  let est = 0;
  let manual = 0;
  let count = 0;
  for (const item of items) {
    if (item.unitPrice === null) {
      manual += 1;
    } else {
      est += item.unitPrice * item.qty;
    }
    count += item.qty;
  }
  return { est, manual, count };
}

/**
 * Port of the estimate rule inside store.js `submitOrder`: when an order is entirely made of
 * manually-priced items, `est` naturally comes out to 0 — but that reads as "free", not "priced
 * after review". Returning null instead lets the UI show the correct "priced after review"
 * message. Orders that mix priced and manual items still surface the partial estimate.
 */
export function estTotalForOrder(totals: Pick<CartTotals, "est" | "manual">): number | null {
  if (totals.manual > 0 && totals.est === 0) return null;
  return totals.est;
}
