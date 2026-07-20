"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./reports.module.css";

export interface ReportsFilterBarProps {
  from: string;
  to: string;
}

/** Date-range filter driving every stat/query on the reports page — writes straight to URL
 * params on change (no debounce needed, unlike free-text search: a date `<input type=date>`
 * only fires on a completed pick). Same "URL params are the source of truth" approach as
 * `admin/orders/OrdersFilterBar.tsx`. */
export function ReportsFilterBar({ from, to }: ReportsFilterBarProps) {
  const router = useRouter();
  const tCommon = useTranslations("adminCommon");
  const t = useTranslations("adminReports");

  function pushQuery(next: { from?: string; to?: string }) {
    const merged = { from, to, ...next };
    const params = new URLSearchParams();
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    const qs = params.toString();
    router.push(qs ? `/admin/reports?${qs}` : "/admin/reports");
  }

  return (
    <div className={styles.filterBar}>
      <input
        type="date"
        value={from}
        onChange={(e) => pushQuery({ from: e.target.value })}
        className={styles.dateInput}
        aria-label={tCommon("dateFrom")}
        dir="ltr"
      />
      <input
        type="date"
        value={to}
        onChange={(e) => pushQuery({ to: e.target.value })}
        className={styles.dateInput}
        aria-label={tCommon("dateTo")}
        dir="ltr"
      />
      {(from || to) && (
        <Link href="/admin/reports" className={styles.clearBtn}>
          {t("clearRange")}
        </Link>
      )}
    </div>
  );
}
