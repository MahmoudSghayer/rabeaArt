"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { cx } from "@/lib/cx";
import styles from "./CustomersTable.module.css";

export type CustomerRow = {
  id: string;
  name: string;
  avatarColor: string;
  phone: string | null;
  city: string | null;
  orderCount: number;
  lastOrderDate: string | null;
  lifetimeValue: number;
};

export interface CustomersViewProps {
  rows: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Query string (no leading `?`, no `page` param) preserving the current search — pagination
   * links append their own `page=N` to this. */
  baseQuery: string;
}

function pageHref(baseQuery: string, page: number): string {
  const qs = baseQuery ? `${baseQuery}&page=${page}` : `page=${page}`;
  return `/admin/customers?${qs}`;
}

export function CustomersView({ rows, total, page, pageSize, baseQuery }: CustomersViewProps) {
  const t = useTranslations("adminCustomers");
  const tCommon = useTranslations("adminCommon");
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className={styles.tableWrap}>
        <div className={styles.tableInner}>
          <div className={styles.headRow}>
            <span>{t("thName")}</span>
            <span>{t("thPhone")}</span>
            <span>{t("thCity")}</span>
            <span>{t("thOrders")}</span>
            <span>{t("thLast")}</span>
            <span>{t("thValue")}</span>
            <span />
          </div>
          {rows.map((row) => (
            <Link key={row.id} href={`/admin/customers/${row.id}`} className={styles.row}>
              <span className={styles.nameCell}>
                <span className={styles.avatar} style={{ background: row.avatarColor }} aria-hidden="true">
                  {[...row.name.trim()][0]?.toUpperCase() ?? "?"}
                </span>
                <span className={styles.name}>{row.name}</span>
              </span>
              <span className={styles.phone} dir="ltr">
                {row.phone ?? tCommon("na")}
              </span>
              <span className={styles.city}>{row.city ?? tCommon("na")}</span>
              <span className={styles.count} dir="ltr">
                {row.orderCount}
              </span>
              <span className={styles.last}>{row.lastOrderDate ?? tCommon("na")}</span>
              <span className={styles.value} dir="ltr">
                {tCommon("currency")}
                {row.lifetimeValue.toLocaleString("en-US")}
              </span>
              <span className={styles.chevron} aria-hidden="true">
                {tCommon("arrow")}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 && <div className={cx(styles.empty)}>{t("noMatches")}</div>}

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
