"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./CustomersFilterBar.module.css";

const SEARCH_DEBOUNCE_MS = 400;

export interface CustomersFilterBarProps {
  initialQ: string;
  csvHref: string;
}

/** Client search bar for the customers list — same "debounce, write to URL params" pattern as
 * `src/app/admin/orders/OrdersFilterBar.tsx`, trimmed down to just search + CSV (no status/pay/
 * sort/date filters for customers). Rendered with a `key` from the URL query string so React
 * remounts (resetting local state) on any outside navigation change. */
export function CustomersFilterBar({ initialQ, csvHref }: CustomersFilterBarProps) {
  const router = useRouter();
  const t = useTranslations("adminCustomers");
  const tCommon = useTranslations("adminCommon");

  const [q, setQ] = useState(initialQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushQuery(value: string) {
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    const qs = params.toString();
    router.push(qs ? `/admin/customers?${qs}` : "/admin/customers");
  }

  function onSearchChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushQuery(value), SEARCH_DEBOUNCE_MS);
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
      <a href={csvHref} className={styles.csvLink}>
        {tCommon("csv")}
      </a>
    </div>
  );
}
