import { OrderStatus } from "@/generated/prisma/enums";

/**
 * Pure order-status transition logic: what stock action a status change implies, and which
 * transitions the admin UI/API should accept. No DB access — callers (the order-update
 * route/service) read `stockAppliedAt` off the Order row, pass `stockApplied: Boolean(...)`,
 * and persist the resulting decision transactionally alongside the status change.
 */

/** Statuses in which previously-applied stock deductions should stay applied. */
const STOCK_HOLDING_STATUSES: readonly OrderStatus[] = [
  OrderStatus.ACCEPTED,
  OrderStatus.PROGRESS,
  OrderStatus.READY,
  OrderStatus.COMPLETED,
];

export type StockAction = "apply" | "release" | "none";

/**
 * Stock lifecycle rule: submitting an order never touches stock (customers aren't guaranteed
 * inventory until an admin reviews the order). Stock is only deducted the moment an order
 * *enters* ACCEPTED, and only once — the `stockApplied` flag (backed by `Order.stockAppliedAt`)
 * makes this idempotent against repeated/duplicate transition calls. Leaving the
 * ACCEPTED/PROGRESS/READY/COMPLETED family — back to a review-family status, or into
 * DECLINED/CANCELLED — releases stock that was previously applied. Moving *within* that family
 * (e.g. PROGRESS -> READY) is a no-op for stock.
 */
export function stockActionForTransition(args: {
  from: OrderStatus;
  to: OrderStatus;
  stockApplied: boolean;
}): StockAction {
  const { to, stockApplied } = args;

  if (to === OrderStatus.ACCEPTED) {
    return stockApplied ? "none" : "apply";
  }
  if (stockApplied && !STOCK_HOLDING_STATUSES.includes(to)) {
    return "release";
  }
  return "none";
}

/**
 * Transition validity is permissive by design: this is an admin-driven manual review workflow,
 * not a rigid state machine, so an admin can move an order to almost any status directly (e.g.
 * skip straight from NEW to ACCEPTED). Two exceptions:
 *  - A same-status "transition" (from === to) is not a real transition.
 *  - COMPLETED and CANCELLED are terminal, with a single deliberate escape hatch: re-opening
 *    the order by moving it back to REVIEW. Any other destination from those two is rejected.
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  if (from === OrderStatus.COMPLETED || from === OrderStatus.CANCELLED) {
    return to === OrderStatus.REVIEW;
  }
  return true;
}
