import { AdminRole } from "@/generated/prisma/enums";

/** Role-pill colors, following the same `{ fg, bg, key }` shape as `ORDER_STATUS_META` /
 * `PAYMENT_STATUS_META` (`lib/orders/status.ts`) — kept local to `admin/users/**` since it's an
 * AdminRole-specific concern the orders domain has no reason to know about. */
export const ROLE_META: Record<AdminRole, { fg: string; bg: string; key: string }> = {
  [AdminRole.OWNER]: { fg: "#8a6410", bg: "#f4e8c6", key: "owner" },
  [AdminRole.ADMIN]: { fg: "#2e5550", bg: "#dceae4", key: "admin" },
  [AdminRole.STAFF]: { fg: "#6b6459", bg: "#ece7db", key: "staff" },
};

export const ROLE_FLOW: AdminRole[] = [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.STAFF];
