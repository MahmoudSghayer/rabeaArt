"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { SupportedLocale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { addFrameAction, removeFrameAction, toggleFrameActiveAction, updateFrameAddPriceAction } from "./actions";
import styles from "./options.module.css";

export type FrameRow = { id: string; labelAr: string; labelEn: string; add: number; active: boolean };

export function FramesCard({ rows }: { rows: FrameRow[] }) {
  const t = useTranslations("adminOptions");
  const tCommon = useTranslations("adminCommon");
  const locale = useLocale() as SupportedLocale;

  const [items, setItems] = useState(rows);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setError(null);
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const nextActive = !target.active;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, active: nextActive } : i)));
    startTransition(async () => {
      const result = await toggleFrameActiveAction(id, nextActive);
      if (!result.ok) setItems((prev) => prev.map((i) => (i.id === id ? { ...i, active: !nextActive } : i)));
    });
  }

  function setPrice(id: string, value: string) {
    const n = Number(value.replace(/[^\d]/g, "")) || 0;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, add: n } : i)));
  }

  function commitPrice(id: string) {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    startTransition(async () => {
      await updateFrameAddPriceAction(id, target.add);
    });
  }

  function removeItem(id: string) {
    setError(null);
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      const result = await removeFrameAction(id);
      if (!result.ok) setItems(snapshot);
    });
  }

  function addFrame() {
    // The plan's mockup collects one label field for the add row; the same text seeds both
    // nameAr/nameEn (an admin can refine the Arabic/English split isn't offered by this simple
    // add row — a deliberate simplification, see final report).
    const label = newLabel.trim();
    if (!label) return;
    setError(null);
    startTransition(async () => {
      const result = await addFrameAction(label, label);
      if (!result.ok) {
        setError(t("frameAddError"));
        return;
      }
      setItems((prev) => [...prev, { id: `pending-${Date.now()}`, labelAr: label, labelEn: label, add: 0, active: true }]);
      setNewLabel("");
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{t("frames")}</div>
      <div className={styles.cardHint}>{t("framesHint")}</div>
      {items.map((f) => (
        <div key={f.id} className={styles.listRow}>
          <button
            type="button"
            onClick={() => toggle(f.id)}
            disabled={pending}
            className={cx(styles.listLabel, !f.active && styles.listLabelInactive)}
          >
            {locale === "ar" ? f.labelAr : f.labelEn}
          </button>
          <span className={styles.priceInputWrap}>
            <span>+</span>
            <input
              value={String(f.add)}
              onChange={(e) => setPrice(f.id, e.target.value)}
              onBlur={() => commitPrice(f.id)}
              inputMode="numeric"
              dir="ltr"
              className={styles.priceInput}
            />
            <span>{tCommon("currency")}</span>
          </span>
          <button type="button" onClick={() => removeItem(f.id)} disabled={pending} className={styles.chipRemove}>
            ×
          </button>
        </div>
      ))}
      <div className={styles.addRow} style={{ marginTop: 12 }}>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFrame();
            }
          }}
          placeholder={t("newFramePh")}
          className={styles.addInput}
        />
        <button type="button" onClick={addFrame} disabled={pending || !newLabel.trim()} className={styles.addBtn}>
          {tCommon("add")}
        </button>
      </div>
      {error && <div className={styles.errorText}>{error}</div>}
    </div>
  );
}
