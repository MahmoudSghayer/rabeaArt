import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "../_lib/require";
import { createTranslator, getAdminLocale, getAdminMessages } from "../_lib/messages";
import { ItemKind, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_FLOW, ORDER_STATUS_META } from "@/lib/orders/status";
import { formatDateTime } from "@/components/admin/format";
import { dateRangeFilter, parseReportsQuery, type ReportsSearchParams } from "./query";
import { ReportsFilterBar } from "./ReportsFilterBar";
import pageStyles from "../admin.module.css";
import styles from "./reports.module.css";

const CUSTOM_ITEM_KINDS = [ItemKind.CUSTOM_SHIRT, ItemKind.CUSTOM_PAINTING, ItemKind.CUSTOM_OTHER];

/**
 * All figures below exclude archived orders (consistent with the customers list's "lifetime
 * value" definition — see `admin/customers/page.tsx`) and are scoped to the `from`/`to` date
 * range from the URL when present.
 *
 * - "Confirmed revenue" = sum of `finalPrice` where payment is PAID or PARTIAL, OR the order's
 *   status is COMPLETED (matches the design reference's `_design-reference/Admin.dc.html`
 *   `revenue` computation: `pay==='paid'||pay==='partial'||status==='completed'`).
 * - "Average order" = mean `finalPrice` across orders that HAVE a final price ("priced orders").
 * - "Custom-order share" = % of orders containing at least one `CUSTOM_SHIRT`/`CUSTOM_PAINTING`/
 *   `CUSTOM_OTHER` item.
 */
async function loadReportsData(range: { gte?: Date; lte?: Date } | undefined) {
  const createdAtFilter = range ? { createdAt: range } : {};

  const [revenueAgg, avgAgg, totalOrders, customOrders, statusGroups, emailGroups, lastFailures] = await Promise.all(
    [
      prisma.order.aggregate({
        where: {
          archived: false,
          ...createdAtFilter,
          OR: [{ pay: { in: [PaymentStatus.PAID, PaymentStatus.PARTIAL] } }, { status: OrderStatus.COMPLETED }],
        },
        _sum: { finalPrice: true },
      }),
      prisma.order.aggregate({
        where: { archived: false, finalPrice: { not: null }, ...createdAtFilter },
        _avg: { finalPrice: true },
      }),
      prisma.order.count({ where: { archived: false, ...createdAtFilter } }),
      prisma.order.count({
        where: { archived: false, ...createdAtFilter, items: { some: { kind: { in: CUSTOM_ITEM_KINDS } } } },
      }),
      prisma.order.groupBy({ by: ["status"], where: { archived: false, ...createdAtFilter }, _count: { _all: true } }),
      prisma.emailLog.groupBy({ by: ["status"], where: range ? { at: range } : {}, _count: { _all: true } }),
      prisma.emailLog.findMany({
        where: { status: "failed", ...(range ? { at: range } : {}) },
        orderBy: { at: "desc" },
        take: 5,
        select: { template: true, error: true, at: true },
      }),
    ],
  );

  const byStatus = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const maxStatusCount = Math.max(1, ...ORDER_STATUS_FLOW.map((s) => byStatus.get(s) ?? 0));
  const bars = ORDER_STATUS_FLOW.map((status) => ({
    status,
    count: byStatus.get(status) ?? 0,
    widthPct: Math.round(((byStatus.get(status) ?? 0) / maxStatusCount) * 100),
  })).filter((b) => b.count > 0);

  const sentCount = emailGroups.find((g) => g.status === "sent")?._count._all ?? 0;
  const failedCount = emailGroups.find((g) => g.status === "failed")?._count._all ?? 0;

  return {
    revenue: revenueAgg._sum.finalPrice !== null ? Number(revenueAgg._sum.finalPrice) : 0,
    avgOrder: avgAgg._avg.finalPrice !== null ? Math.round(Number(avgAgg._avg.finalPrice)) : 0,
    customSharePct: totalOrders > 0 ? Math.round((customOrders / totalOrders) * 100) : 0,
    bars,
    emailSent: sentCount,
    emailFailed: failedCount,
    lastFailures,
  };
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<ReportsSearchParams> }) {
  await requireAdminPage();
  const rawParams = await searchParams;
  const parsed = parseReportsQuery(rawParams);
  const range = dateRangeFilter(parsed);
  const locale = await getAdminLocale();
  const t = createTranslator(await getAdminMessages(locale), "adminReports");
  const tCommon = createTranslator(await getAdminMessages(locale), "adminCommon");
  const tStatus = createTranslator(await getAdminMessages(locale), "orderStatus");

  let data: Awaited<ReturnType<typeof loadReportsData>> | null = null;
  let loadError = false;
  try {
    data = await loadReportsData(range);
  } catch (err) {
    console.error("AdminReportsPage: failed to load report data", err);
    loadError = true;
  }

  const exportQuery = new URLSearchParams();
  if (parsed.fromRaw) exportQuery.set("from", parsed.fromRaw);
  if (parsed.toRaw) exportQuery.set("to", parsed.toRaw);
  const exportQs = exportQuery.toString();
  const ordersExportHref = `/api/admin/orders/export${exportQs ? `?${exportQs}` : ""}`;
  const customersExportHref = "/api/admin/customers/export";

  return (
    <div className={pageStyles.page}>
      <ReportsFilterBar from={parsed.fromRaw} to={parsed.toRaw} />

      {loadError || !data ? (
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 20 }}>{t("loadError")}</div>
      ) : (
        <>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t("confirmedRevenue")}</div>
              <div className={styles.statValue} dir="ltr">
                {tCommon("currency")}
                {data.revenue.toLocaleString("en-US")}
              </div>
              <div className={styles.statHint}>{t("confirmedRevenueHint")}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t("avgOrder")}</div>
              <div className={styles.statValue} dir="ltr">
                {tCommon("currency")}
                {data.avgOrder.toLocaleString("en-US")}
              </div>
              <div className={styles.statHint}>{t("avgOrderHint")}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t("customShare")}</div>
              <div className={styles.statValue} dir="ltr">
                {data.customSharePct}%
              </div>
              <div className={styles.statHint}>{t("customShareHint")}</div>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelTitle}>{t("statusBreakdown")}</div>
            {data.bars.length === 0 ? (
              <div className={styles.emptyInline}>{tCommon("emptyGeneric")}</div>
            ) : (
              <div className={styles.barsList}>
                {data.bars.map((bar) => (
                  <div key={bar.status} className={styles.barRow}>
                    <span className={styles.barLabel}>{tStatus(ORDER_STATUS_META[bar.status].key)}</span>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${bar.widthPct}%`, background: ORDER_STATUS_META[bar.status].fg }}
                      />
                    </div>
                    <span className={styles.barCount} dir="ltr">
                      {bar.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelTitle}>{t("emailLogTitle")}</div>
            <div className={styles.panelHint}>{t("emailLogHint")}</div>
            <div className={styles.emailSummaryRow}>
              <div className={styles.emailStat}>
                <span className={styles.emailStatLabel}>{t("emailSent")}</span>
                <span className={styles.emailStatValue} dir="ltr">
                  {data.emailSent}
                </span>
              </div>
              <div className={styles.emailStat}>
                <span className={styles.emailStatLabel}>{t("emailFailed")}</span>
                <span className={styles.emailStatValue} dir="ltr">
                  {data.emailFailed}
                </span>
              </div>
            </div>
            {data.lastFailures.length === 0 ? (
              <div className={styles.emptyInline}>{t("noFailures")}</div>
            ) : (
              data.lastFailures.map((f, i) => (
                <div key={i} className={styles.failureRow}>
                  <div className={styles.failureTemplate}>{f.template}</div>
                  <div className={styles.failureError}>{f.error ?? tCommon("errorGeneric")}</div>
                  <div className={styles.failureAt}>{formatDateTime(f.at, locale)}</div>
                </div>
              ))
            )}
          </div>

          <div className={styles.panel}>
            <div className={styles.panelTitle}>{t("exports")}</div>
            <div className={styles.panelHint}>{t("exportsHint")}</div>
            <div className={styles.exportsRow}>
              <a href={ordersExportHref} className={styles.exportBtn}>
                ⤓ {t("exportOrdersBtn")}
              </a>
              <a href={customersExportHref} className={styles.exportBtn}>
                ⤓ {t("exportCustBtn")}
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
