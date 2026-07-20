"use client";

import { useMessages, useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { formatBytes, formatMoney, artKeyForId } from "@/components/admin/format";
import { grainedArt } from "@/components/storefront/art";
import { cx } from "@/lib/cx";
import type { OrderDetailItem } from "./OrderDetailView";
import styles from "./orderDetail.module.css";

/** Looks a raw `optionsJson` key up in the `adminOptionKeys` messages namespace, falling back to
 * the raw key itself for anything not in that best-effort map (see project plan: "translate known
 * option KEYS via messages, values shown raw"). Reads the raw message tree via `useMessages()`
 * rather than `useTranslations()` so an unknown key degrades to itself instead of a next-intl
 * console warning. */
function useOptionKeyLabel() {
  const messages = useMessages() as { adminOptionKeys?: Record<string, string> };
  return (key: string) => messages.adminOptionKeys?.[key] ?? key;
}

export function ItemsPanel({
  items,
  estTotal,
  custNotes,
}: {
  items: OrderDetailItem[];
  estTotal: number | null;
  custNotes: string | null;
}) {
  const t = useTranslations("adminOrderDetail");
  const tCommon = useTranslations("adminCommon");
  const optionKeyLabel = useOptionKeyLabel();

  return (
    <Card>
      <div className={styles.panelLabel}>
        {t("orderItemsTitle")} ({items.length})
      </div>

      {items.length === 0 && <div className={styles.emptyInline}>{t("noItems")}</div>}

      {items.map((item) => {
        const optionsLine = item.options.map((o) => `${optionKeyLabel(o.key)}: ${o.value}`).join(" · ");
        return (
          <div key={item.id} className={styles.itemRow}>
            {item.files.length > 0 ? (
              <span className={cx(styles.itemThumb, styles.itemThumbFiles)} aria-hidden="true">
                🗂
                <br />
                {item.files.length}
              </span>
            ) : (
              <span
                className={styles.itemThumb}
                style={{ backgroundImage: grainedArt(artKeyForId(item.id)) }}
                aria-hidden="true"
              />
            )}
            <div className={styles.itemBody}>
              <div className={styles.itemName}>
                {item.label} <span className={styles.itemQty}>× {item.qty}</span>
              </div>
              {optionsLine && <div className={styles.itemOptions}>{optionsLine}</div>}
              {item.notes && <div className={styles.itemNotes}>&ldquo;{item.notes}&rdquo;</div>}
              {item.files.length > 0 && (
                <div className={styles.fileChips}>
                  {item.files.map((f) => (
                    <a
                      key={f.id}
                      href={`/api/admin/files/${f.id}`}
                      title={f.name}
                      className={styles.fileChip}
                    >
                      <span className={styles.fileChipName} dir="ltr">
                        {f.name}
                      </span>
                      <span className={styles.fileChipSize} dir="ltr">
                        {formatBytes(f.size)}
                      </span>
                      <span className={styles.fileChipIcon} aria-hidden="true">
                        ⤓
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
            <span
              className={cx(styles.itemPrice, item.unitPrice === null && styles.itemPriceManual)}
              dir="ltr"
            >
              {item.unitPrice === null ? t("unitPriceManual") : formatMoney(item.unitPrice, "")}
            </span>
          </div>
        );
      })}

      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>{t("estTotal")}</span>
        <span className={styles.totalValue} dir="ltr">
          {formatMoney(estTotal, tCommon("afterReview"))}
        </span>
      </div>

      {custNotes && (
        <div className={styles.custNotesCallout}>
          <b>{t("custNotesLabel")}:</b> {custNotes}
        </div>
      )}
    </Card>
  );
}
