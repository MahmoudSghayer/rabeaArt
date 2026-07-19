"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PaymentStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_FLOW, ORDER_STATUS_META, PAYMENT_STATUS_META } from "@/lib/orders/status";
import styles from "./OrdersFilterBar.module.css";

const PAY_OPTIONS = Object.values(PaymentStatus);
const SEARCH_DEBOUNCE_MS = 400;

export interface OrdersFilterValues {
  q: string;
  status: string;
  pay: string;
  from: string;
  to: string;
  sort: "newest" | "oldest" | "valueDesc";
}

export interface OrdersFilterBarProps {
  initial: OrdersFilterValues;
  csvHref: string;
}

/**
 * Client filter bar for the orders list, following the same "write to URL params" pattern as the
 * storefront shop filters. Rendered with a `key` from the URL's query string (see
 * src/app/admin/orders/page.tsx) so React remounts it — resetting local state — whenever
 * navigation changes the params from outside this component (e.g. an Overview stat-card link).
 */
export function OrdersFilterBar({ initial, csvHref }: OrdersFilterBarProps) {
  const router = useRouter();
  const t = useTranslations("adminOrders");
  const tCommon = useTranslations("adminCommon");
  const tStatus = useTranslations("orderStatus");
  const tPay = useTranslations("paymentStatus");

  const [q, setQ] = useState(initial.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushQuery(next: Partial<OrdersFilterValues>) {
    const merged = { ...initial, q, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.status) params.set("status", merged.status);
    if (merged.pay) params.set("pay", merged.pay);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);
    const qs = params.toString();
    router.push(qs ? `/admin/orders?${qs}` : "/admin/orders");
  }

  function onSearchChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushQuery({ q: value }), SEARCH_DEBOUNCE_MS);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className={styles.bar}>
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon} aria-hidden="true">
          ⌕
        </span>
        <input
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className={styles.searchInput}
        />
      </div>

      <select
        value={initial.status}
        onChange={(e) => pushQuery({ status: e.target.value })}
        className={styles.select}
        aria-label={t("thStatus")}
      >
        <option value="">{tCommon("allStatuses")}</option>
        {ORDER_STATUS_FLOW.map((s) => (
          <option key={s} value={s}>
            {tStatus(ORDER_STATUS_META[s].key as never)}
          </option>
        ))}
      </select>

      <select
        value={initial.pay}
        onChange={(e) => pushQuery({ pay: e.target.value })}
        className={styles.select}
        aria-label={t("thPay")}
      >
        <option value="">{tCommon("allPays")}</option>
        {PAY_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {tPay(PAYMENT_STATUS_META[p].key as never)}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={initial.from}
        onChange={(e) => pushQuery({ from: e.target.value })}
        className={styles.dateInput}
        aria-label={tCommon("dateFrom")}
        dir="ltr"
      />
      <input
        type="date"
        value={initial.to}
        onChange={(e) => pushQuery({ to: e.target.value })}
        className={styles.dateInput}
        aria-label={tCommon("dateTo")}
        dir="ltr"
      />

      <select
        value={initial.sort}
        onChange={(e) => pushQuery({ sort: e.target.value as OrdersFilterValues["sort"] })}
        className={styles.select}
      >
        <option value="newest">{tCommon("sortNewest")}</option>
        <option value="oldest">{tCommon("sortOldest")}</option>
        <option value="valueDesc">{tCommon("sortValueDesc")}</option>
      </select>

      <a href={csvHref} className={styles.csvLink}>
        {tCommon("csv")}
      </a>
    </div>
  );
}
