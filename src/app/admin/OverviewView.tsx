"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { OrderStatus } from "@/generated/prisma/enums";
import { OrderStatusPill } from "@/components/ui/StatusPill";
import { formatDate, formatMoney } from "@/components/admin/format";
import type { SupportedLocale } from "@/i18n/routing";
import styles from "./page.module.css";

export type OverviewStats = {
  new: number;
  awaiting: number;
  inProgress: number;
  completed: number;
  totalOrders: number;
  accepted: number;
  declined: number;
  cancelled: number;
  paid: number;
  unpaid: number;
  customers: number;
  customRequests: number;
};

export type RecentOrder = {
  id: string;
  ref: string;
  createdAt: string;
  status: OrderStatus;
  customerName: string;
  total: number | null;
};

export type OverviewData = { stats: OverviewStats; recent: RecentOrder[] };

const PRIMARY: {
  statKey: keyof OverviewStats;
  labelKey: string;
  subKey: string;
  statuses: OrderStatus[];
  colorVar: string;
}[] = [
  {
    statKey: "new",
    labelKey: "statNewLabel",
    subKey: "statNewSub",
    statuses: [OrderStatus.NEW],
    colorVar: "var(--status-new-fg)",
  },
  {
    statKey: "awaiting",
    labelKey: "statAwaitingLabel",
    subKey: "statAwaitingSub",
    statuses: [OrderStatus.REVIEW, OrderStatus.QUOTED, OrderStatus.NEEDS_INFO],
    colorVar: "var(--status-review-fg)",
  },
  {
    statKey: "inProgress",
    labelKey: "statInProgressLabel",
    subKey: "statInProgressSub",
    statuses: [OrderStatus.ACCEPTED, OrderStatus.PROGRESS, OrderStatus.READY],
    colorVar: "var(--status-progress-fg)",
  },
  {
    statKey: "completed",
    labelKey: "statCompletedLabel",
    subKey: "statCompletedSub",
    statuses: [OrderStatus.COMPLETED],
    colorVar: "var(--status-completed-fg)",
  },
];

const SECONDARY: { statKey: keyof OverviewStats; labelKey: string }[] = [
  { statKey: "totalOrders", labelKey: "secTotalOrders" },
  { statKey: "accepted", labelKey: "secAccepted" },
  { statKey: "declined", labelKey: "secDeclined" },
  { statKey: "cancelled", labelKey: "secCancelled" },
  { statKey: "paid", labelKey: "secPaid" },
  { statKey: "unpaid", labelKey: "secUnpaid" },
  { statKey: "customers", labelKey: "secCustomers" },
  { statKey: "customRequests", labelKey: "secCustomRequests" },
];

export function OverviewView({ data }: { data: OverviewData | null }) {
  const t = useTranslations("adminOverview");
  const tCommon = useTranslations("adminCommon");
  const locale = useLocale() as SupportedLocale;

  if (!data) {
    return <div className={styles.empty}>{t("loadError")}</div>;
  }

  const { stats, recent } = data;

  return (
    <>
      <div className={styles.primaryGrid}>
        {PRIMARY.map((card) => (
          <Link
            key={card.statKey}
            href={`/admin/orders?status=${card.statuses.join(",")}`}
            className={styles.primaryCard}
            style={{ "--stat-color": card.colorVar } as CSSProperties}
          >
            <div className={styles.primaryLabel}>{t(card.labelKey)}</div>
            <div className={styles.primaryValue} dir="ltr">
              {stats[card.statKey]}
            </div>
            <div className={styles.primarySub}>{t(card.subKey)}</div>
          </Link>
        ))}
      </div>

      <div className={styles.secondaryGrid}>
        {SECONDARY.map((tile) => (
          <div key={tile.statKey} className={styles.secondaryTile}>
            <div className={styles.secondaryLabel}>{t(tile.labelKey)}</div>
            <div className={styles.secondaryValue} dir="ltr">
              {stats[tile.statKey]}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>{t("recentOrders")}</span>
          <div className={styles.panelSpacer} />
          <Link href="/admin/orders" className={styles.panelLink}>
            {t("allOrders")} {tCommon("arrow")}
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className={styles.empty}>{t("noRecentOrders")}</div>
        ) : (
          recent.map((order) => (
            <Link key={order.id} href={`/admin/orders/${order.id}`} className={styles.row}>
              <span className={styles.rowRef} dir="ltr">
                {order.ref}
              </span>
              <span className={styles.rowName}>{order.customerName}</span>
              <span className={styles.rowDate}>{formatDate(order.createdAt, locale)}</span>
              <OrderStatusPill status={order.status} />
              <span className={styles.rowTotal} dir="ltr">
                {formatMoney(order.total, tCommon("afterReview"))}
              </span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
