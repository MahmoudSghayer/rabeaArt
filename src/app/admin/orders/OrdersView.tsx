"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { OrderStatusPill, PaymentStatusPill } from "@/components/ui/StatusPill";
import { cx } from "@/lib/cx";
import { formatDate, formatMoney } from "@/components/admin/format";
import type { SupportedLocale } from "@/i18n/routing";
import styles from "./OrdersTable.module.css";

export type OrderRow = {
  id: string;
  ref: string;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  firstItemLabel: string;
  moreItemsCount: number;
  status: OrderStatus;
  pay: PaymentStatus;
  total: number | null;
  archived: boolean;
};

export interface OrdersViewProps {
  rows: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Query string (no leading `?`, no `page` param) preserving the current filters — pagination
   * links append their own `page=N` to this. */
  baseQuery: string;
}

function pageHref(baseQuery: string, page: number): string {
  const qs = baseQuery ? `${baseQuery}&page=${page}` : `page=${page}`;
  return `/admin/orders?${qs}`;
}

export function OrdersView({ rows, total, page, pageSize, baseQuery }: OrdersViewProps) {
  const t = useTranslations("adminOrders");
  const tCommon = useTranslations("adminCommon");
  const locale = useLocale() as SupportedLocale;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className={styles.tableWrap}>
        <div className={styles.tableInner}>
          <div className={styles.headRow}>
            <span>{t("thRef")}</span>
            <span>{t("thCustomer")}</span>
            <span>{t("thItems")}</span>
            <span>{t("thTotal")}</span>
            <span>{t("thStatus")}</span>
            <span>{t("thPay")}</span>
            <span />
          </div>
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/admin/orders/${row.id}`}
              className={cx(styles.row, row.archived && styles.rowArchived)}
            >
              <span>
                <span className={styles.ref} dir="ltr">
                  {row.ref}
                </span>
                <span className={styles.date}>{formatDate(row.createdAt, locale)}</span>
              </span>
              <span>
                <span className={styles.customerName}>{row.customerName}</span>
                <span className={styles.customerPhone} dir="ltr">
                  {row.customerPhone}
                </span>
              </span>
              <span className={styles.items}>
                {row.firstItemLabel}
                {row.moreItemsCount > 0 ? ` ${t("itemsMore", { count: row.moreItemsCount })}` : ""}
              </span>
              <span className={styles.total} dir="ltr">
                {formatMoney(row.total, tCommon("afterReview"))}
              </span>
              <span>
                <OrderStatusPill status={row.status} />
              </span>
              <span>
                <PaymentStatusPill status={row.pay} />
              </span>
              <span className={styles.chevron} aria-hidden="true">
                {tCommon("arrow")}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 && <div className={styles.empty}>{t("noMatches")}</div>}

      {pageCount > 1 && (
        <div className={styles.pagination}>
          <Link
            href={pageHref(baseQuery, Math.max(1, page - 1))}
            className={cx(styles.pageBtn, page <= 1 && styles.pageBtnDisabled)}
            aria-disabled={page <= 1}
          >
            {tCommon("previous")}
          </Link>
          <span className={styles.pageInfo}>
            {tCommon("page")} {page} {tCommon("of")} {pageCount}
          </span>
          <Link
            href={pageHref(baseQuery, Math.min(pageCount, page + 1))}
            className={cx(styles.pageBtn, page >= pageCount && styles.pageBtnDisabled)}
            aria-disabled={page >= pageCount}
          >
            {tCommon("next")}
          </Link>
        </div>
      )}
    </>
  );
}
