"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./FilesFilterBar.module.css";

const SEARCH_DEBOUNCE_MS = 400;

/** Search-by-order-ref bar for the files grid — same debounced "write to URL params" pattern as
 * `admin/orders/OrdersFilterBar.tsx` / `admin/customers/CustomersFilterBar.tsx`. Also renders the
 * "private, admins only" hint line the design calls for above the grid. */
export function FilesFilterBar({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const t = useTranslations("adminFiles");

  const [q, setQ] = useState(initialQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushQuery(value: string) {
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    const qs = params.toString();
    router.push(qs ? `/admin/files?${qs}` : "/admin/files");
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
    <>
      <div className={styles.hint}>{t("hint")}</div>
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
      </div>
    </>
  );
}
