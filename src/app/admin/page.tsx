import { prisma } from "@/lib/prisma";
import { ItemKind, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { requireAdminPage } from "./_lib/require";
import { OverviewView, type OverviewData } from "./OverviewView";
import pageStyles from "./admin.module.css";

/**
 * Five grouped queries total (see project plan's "keep it to ≤5 queries"): a status groupBy, a
 * pay groupBy, two counts, and one bounded findMany for the recent-orders panel. All primary/
 * secondary stat tiles are derived from the two groupBys in JS rather than issuing a query per
 * tile.
 */
async function loadOverview(): Promise<OverviewData | null> {
  try {
    const [statusGroups, payGroups, customersCount, customRequestsCount, recentOrders] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.order.groupBy({ by: ["pay"], _count: { _all: true } }),
      prisma.customer.count(),
      prisma.order.count({
        where: {
          items: {
            some: { kind: { in: [ItemKind.CUSTOM_SHIRT, ItemKind.CUSTOM_PAINTING, ItemKind.CUSTOM_OTHER] } },
          },
        },
      }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          ref: true,
          createdAt: true,
          status: true,
          estTotal: true,
          finalPrice: true,
          customer: { select: { name: true } },
        },
      }),
    ]);

    const byStatus = new Map(statusGroups.map((g) => [g.status, g._count._all]));
    const byPay = new Map(payGroups.map((g) => [g.pay, g._count._all]));
    const countOf = (s: OrderStatus) => byStatus.get(s) ?? 0;

    return {
      stats: {
        new: countOf(OrderStatus.NEW),
        awaiting: countOf(OrderStatus.REVIEW) + countOf(OrderStatus.QUOTED) + countOf(OrderStatus.NEEDS_INFO),
        inProgress: countOf(OrderStatus.ACCEPTED) + countOf(OrderStatus.PROGRESS) + countOf(OrderStatus.READY),
        completed: countOf(OrderStatus.COMPLETED),
        totalOrders: Array.from(byStatus.values()).reduce((sum, n) => sum + n, 0),
        accepted: countOf(OrderStatus.ACCEPTED),
        declined: countOf(OrderStatus.DECLINED),
        cancelled: countOf(OrderStatus.CANCELLED),
        paid: byPay.get(PaymentStatus.PAID) ?? 0,
        unpaid: byPay.get(PaymentStatus.UNPAID) ?? 0,
        customers: customersCount,
        customRequests: customRequestsCount,
      },
      recent: recentOrders.map((o) => ({
        id: o.id,
        ref: o.ref,
        createdAt: o.createdAt.toISOString(),
        status: o.status,
        customerName: o.customer.name,
        total: o.finalPrice !== null ? Number(o.finalPrice) : o.estTotal !== null ? Number(o.estTotal) : null,
      })),
    };
  } catch (err) {
    console.error("AdminOverviewPage: failed to load overview stats", err);
    return null;
  }
}

export default async function AdminOverviewPage() {
  await requireAdminPage();
  const data = await loadOverview();

  return (
    <div className={pageStyles.page}>
      <OverviewView data={data} />
    </div>
  );
}
