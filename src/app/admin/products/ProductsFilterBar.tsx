"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ProductType } from "@/generated/prisma/enums";
import styles from "./ProductsFilterBar.module.css";

const SEARCH_DEBOUNCE_MS = 400;

export interface ProductsFilterValues {
  q: string;
  type: string;
  archived: boolean;
}

export interface ProductsFilterBarProps {
  initial: ProductsFilterValues;
}

/** Search + type + archived-visibility toolbar for the products grid, following the same
 * "write to URL params" pattern as the orders list filter bar. Remounted (via a `key` from the
 * URL's query string in page.tsx) whenever navigation changes the params from outside. */
export function ProductsFilterBar({ initial }: ProductsFilterBarProps) {
  const router = useRouter();
  const t = useTranslations("adminProducts");

  const [q, setQ] = useState(initial.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushQuery(next: Partial<ProductsFilterValues>) {
    const merged = { ...initial, q, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.type) params.set("type", merged.type);
    if (merged.archived) params.set("archived", "1");
    const qs = params.toString();
    router.push(qs ? `/admin/products?${qs}` : "/admin/products");
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
        value={initial.type}
        onChange={(e) => pushQuery({ type: e.target.value })}
        className={styles.select}
        aria-label={t("filterType")}
      >
        <option value="">{t("allTypes")}</option>
        <option value={ProductType.SHIRT}>{t("typeShirt")}</option>
        <option value={ProductType.PAINTING}>{t("typePainting")}</option>
      </select>

      <label className={styles.archivedToggle}>
        <input
          type="checkbox"
          checked={initial.archived}
          onChange={(e) => pushQuery({ archived: e.target.checked })}
        />
        {t("showArchived")}
      </label>

      <div className={styles.spacer} />

      <Link href="/admin/products/new" className={styles.newBtn}>
        + {t("newProduct")}
      </Link>
    </div>
  );
}
