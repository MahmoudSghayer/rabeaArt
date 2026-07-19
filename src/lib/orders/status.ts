import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

/**
 * Maps each status to its CSS custom property pair (see src/styles/tokens.css) and the
 * message key under the "orderStatus"/"paymentStatus" i18n namespace. Kept as a single source
 * of truth so admin filters, storefront confirmation pills, and CSV exports agree.
 */
export const ORDER_STATUS_META: Record<OrderStatus, { fg: string; bg: string; key: string }> = {
  [OrderStatus.NEW]: { fg: "var(--status-new-fg)", bg: "var(--status-new-bg)", key: "new" },
  [OrderStatus.REVIEW]: { fg: "var(--status-review-fg)", bg: "var(--status-review-bg)", key: "review" },
  [OrderStatus.NEEDS_INFO]: {
    fg: "var(--status-needs-info-fg)",
    bg: "var(--status-needs-info-bg)",
    key: "needsInfo",
  },
  [OrderStatus.QUOTED]: { fg: "var(--status-quoted-fg)", bg: "var(--status-quoted-bg)", key: "quoted" },
  [OrderStatus.ACCEPTED]: {
    fg: "var(--status-accepted-fg)",
    bg: "var(--status-accepted-bg)",
    key: "accepted",
  },
  [OrderStatus.DECLINED]: {
    fg: "var(--status-declined-fg)",
    bg: "var(--status-declined-bg)",
    key: "declined",
  },
  [OrderStatus.PROGRESS]: {
    fg: "var(--status-progress-fg)",
    bg: "var(--status-progress-bg)",
    key: "progress",
  },
  [OrderStatus.READY]: { fg: "var(--status-ready-fg)", bg: "var(--status-ready-bg)", key: "ready" },
  [OrderStatus.COMPLETED]: {
    fg: "var(--status-completed-fg)",
    bg: "var(--status-completed-bg)",
    key: "completed",
  },
  [OrderStatus.CANCELLED]: {
    fg: "var(--status-cancelled-fg)",
    bg: "var(--status-cancelled-bg)",
    key: "cancelled",
  },
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, { fg: string; bg: string; key: string }> = {
  [PaymentStatus.NOT_REQUIRED]: {
    fg: "var(--pay-not-required-fg)",
    bg: "var(--pay-not-required-bg)",
    key: "notRequired",
  },
  [PaymentStatus.UNPAID]: { fg: "var(--pay-unpaid-fg)", bg: "var(--pay-unpaid-bg)", key: "unpaid" },
  [PaymentStatus.PARTIAL]: { fg: "var(--pay-partial-fg)", bg: "var(--pay-partial-bg)", key: "partial" },
  [PaymentStatus.PAID]: { fg: "var(--pay-paid-fg)", bg: "var(--pay-paid-bg)", key: "paid" },
  [PaymentStatus.REFUNDED]: {
    fg: "var(--pay-refunded-fg)",
    bg: "var(--pay-refunded-bg)",
    key: "refunded",
  },
};

/**
 * Order status transitions the admin UI allows picking from directly. Terminal states
 * (COMPLETED, CANCELLED, DECLINED) are reachable but the UI doesn't offer a "next" beyond
 * them other than re-opening via REVIEW — enforced here so the whole app agrees on the flow.
 */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.REVIEW,
  OrderStatus.NEEDS_INFO,
  OrderStatus.QUOTED,
  OrderStatus.ACCEPTED,
  OrderStatus.DECLINED,
  OrderStatus.PROGRESS,
  OrderStatus.READY,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
];
