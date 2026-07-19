/**
 * Structured error thrown by `applyStock` when one or more variants don't have enough stock to
 * cover the order. Thrown *inside* the caller's `prisma.$transaction` callback so the whole
 * transition (order status update, history row, audit log) rolls back atomically — see
 * STOCK-ACCEPT RULE in the project plan: accepting an order never partially applies stock.
 */

export type StockShortfall = {
  variantId: string;
  /** Best-effort human label, e.g. "Dawn Threads Shirt (Ink / M)" — built from whatever
   * product/color/size names are available; never blocks on a missing name. */
  label: string;
  needed: number;
  available: number;
};

export class InventoryError extends Error {
  readonly shortfalls: StockShortfall[];

  constructor(shortfalls: StockShortfall[]) {
    const summary = shortfalls
      .map((s) => `${s.label}: need ${s.needed}, have ${s.available}`)
      .join("; ");
    super(`Insufficient stock — ${summary}`);
    this.name = "InventoryError";
    this.shortfalls = shortfalls;
  }
}
