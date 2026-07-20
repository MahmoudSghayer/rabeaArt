"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SizeScope } from "@/generated/prisma/enums";
import type { SupportedLocale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { addPaintingSizeAction, addShirtSizeAction, removeSizeAction, toggleSizeActiveAction } from "./actions";
import styles from "./options.module.css";

export type SizeRow = { id: string; code: string; labelAr: string; labelEn: string; active: boolean };

export interface SizesCardProps {
  scope: SizeScope;
  rows: SizeRow[];
}

/** Shared card for both size lists (Size scope SHIRT / PAINTING) — same add/toggle/remove
 * mechanics, just a different scope and (for PAINTING) a protected non-removable "custom" row. */
export function SizesCard({ scope, rows }: SizesCardProps) {
  const t = useTranslations("adminOptions");
  const tCommon = useTranslations("adminCommon");
  const locale = useLocale() as SupportedLocale;
  const isShirt = scope === SizeScope.SHIRT;

  const [items, setItems] = useState(rows);
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setError(null);
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const nextActive = !target.active;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, active: nextActive } : i)));
    startTransition(async () => {
      const result = await toggleSizeActiveAction(id, nextActive);
      if (!result.ok) setItems((prev) => prev.map((i) => (i.id === id ? { ...i, active: !nextActive } : i)));
    });
  }

  function removeItem(id: string) {
    setError(null);
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      const result = await removeSizeAction(id);
      if (!result.ok) setItems(snapshot);
    });
  }

  function addSize() {
    const code = newCode.trim();
    if (!code) return;
    setError(null);
    startTransition(async () => {
      const result = isShirt ? await addShirtSizeAction(code) : await addPaintingSizeAction(code);
      if (!result.ok) {
        setError(result.error === "DUPLICATE" ? t("sizeDuplicate") : t("sizeAddError"));
        return;
      }
      // Mirrors the server's codeSchema transform (see options/actions.ts) for the optimistic row.
      const upperCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      setItems((prev) => [...prev, { id: `pending-${upperCode}`, code: upperCode, labelAr: upperCode, labelEn: upperCode, active: true }]);
      setNewCode("");
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{isShirt ? t("shirtSizes") : t("paintSizes")}</div>
      <div className={styles.cardHint}>{isShirt ? t("shirtSizesHint") : t("paintSizesHint")}</div>
      <div className={styles.chipRow}>
        {items.map((s) => {
          const isProtected = !isShirt && s.code === "custom";
          const label = locale === "ar" ? s.labelAr : s.labelEn;
          return (
            <span key={s.id} className={cx(styles.chip, !s.active && styles.chipInactive)}>
              <button
                type="button"
                onClick={() => toggle(s.id)}
                disabled={pending}
                className={cx(styles.chipToggle, !s.active && styles.chipToggleInactive)}
              >
                {isProtected ? t("customSizeLabel") : label}
              </button>
              {!isProtected && (
                <button
                  type="button"
                  onClick={() => removeItem(s.id)}
                  disabled={pending}
                  title={t("removeSize")}
                  className={styles.chipRemove}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>
      <div className={styles.addRow}>
        <input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSize();
            }
          }}
          placeholder={isShirt ? t("newSizePh") : t("newPaintSizePh")}
          dir="ltr"
          className={styles.addInput}
        />
        <button type="button" onClick={addSize} disabled={pending || !newCode.trim()} className={styles.addBtn}>
          {tCommon("add")}
        </button>
      </div>
      {error && <div className={styles.errorText}>{error}</div>}
    </div>
  );
}
