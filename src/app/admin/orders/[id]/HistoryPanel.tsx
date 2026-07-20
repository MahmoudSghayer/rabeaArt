"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { OrderStatusPill } from "@/components/ui/StatusPill";
import { formatDateTime } from "@/components/admin/format";
import type { SupportedLocale } from "@/i18n/routing";
import type { OrderHistoryEntry } from "./OrderDetailView";
import styles from "./orderDetail.module.css";

/** Reverse-chronological status history (already sorted by the server query). A row with a
 * `note` (e.g. "Final price set: ₪520") shows the note text; a plain transition row shows the
 * resulting status as a pill. */
export function HistoryPanel({ history }: { history: OrderHistoryEntry[] }) {
  const t = useTranslations("adminOrderDetail");
  const locale = useLocale() as SupportedLocale;

  return (
    <Card>
      <div className={styles.panelLabel}>{t("historyTitle")}</div>
      {history.length === 0 && <div className={styles.emptyInline}>{t("noHistory")}</div>}
      {history.map((h) => (
        <div key={h.id} className={styles.historyRow}>
          <span className={styles.historyDot} aria-hidden="true" />
          <span className={styles.historyText}>
            {h.note ?? <OrderStatusPill status={h.status} />}
          </span>
          <span className={styles.historyAt}>{formatDateTime(h.at, locale)}</span>
        </div>
      ))}
    </Card>
  );
}
