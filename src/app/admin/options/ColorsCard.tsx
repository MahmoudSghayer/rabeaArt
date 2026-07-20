"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { SupportedLocale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { addColorAction, toggleColorActiveAction } from "./actions";
import styles from "./options.module.css";

export type ColorRow = { id: string; code: string; nameAr: string; nameEn: string; hex: string; active: boolean };

const DEFAULT_HEX = "#B7472A";

/** Add + toggle only, per the plan — colours have no inline rename/hex-edit or removal in this
 * pass (unlike sizes/frames, which also support remove-if-unused). */
export function ColorsCard({ rows }: { rows: ColorRow[] }) {
  const t = useTranslations("adminOptions");
  const locale = useLocale() as SupportedLocale;

  const [items, setItems] = useState(rows);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [hex, setHex] = useState(DEFAULT_HEX);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setError(null);
    const target = items.find((i) => i.id === id);
    if (!target) return;
    const nextActive = !target.active;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, active: nextActive } : i)));
    startTransition(async () => {
      const result = await toggleColorActiveAction(id, nextActive);
      if (!result.ok) setItems((prev) => prev.map((i) => (i.id === id ? { ...i, active: !nextActive } : i)));
    });
  }

  function addColor() {
    if (!nameAr.trim() || !nameEn.trim() || !/^#[0-9a-fA-F]{6}$/.test(hex.trim())) {
      setError(t("colorAddError"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addColorAction(nameAr.trim(), nameEn.trim(), hex.trim());
      if (!result.ok) {
        setError(t("colorAddError"));
        return;
      }
      setItems((prev) => [
        ...prev,
        { id: `pending-${Date.now()}`, code: nameEn.trim().toLowerCase(), nameAr: nameAr.trim(), nameEn: nameEn.trim(), hex: hex.trim(), active: true },
      ]);
      setNameAr("");
      setNameEn("");
      setHex(DEFAULT_HEX);
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{t("colors")}</div>
      <div className={styles.cardHint}>{t("colorsHint")}</div>
      {items.map((c) => (
        <div key={c.id} className={styles.colorRow}>
          <span className={styles.colorSwatch} style={{ background: c.hex }} />
          <div className={styles.colorNames}>
            <div className={styles.colorNameEn}>{locale === "ar" ? c.nameAr : c.nameEn}</div>
            <div className={styles.colorNameAr}>{locale === "ar" ? c.nameEn : c.nameAr}</div>
          </div>
          <button
            type="button"
            onClick={() => toggle(c.id)}
            disabled={pending}
            className={cx(styles.toggleBtn, c.active && styles.toggleBtnActive)}
          >
            {c.active ? t("active") : t("inactive")}
          </button>
        </div>
      ))}
      <div className={styles.addColorGrid} style={{ marginTop: 12 }}>
        <input
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          placeholder={t("colorNameArPh")}
          dir="rtl"
          className={styles.addInput}
        />
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder={t("colorNameEnPh")}
          dir="ltr"
          className={styles.addInput}
        />
        <input
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          dir="ltr"
          className={cx(styles.addInput, styles.hexInput)}
        />
      </div>
      <div className={styles.addRow} style={{ marginTop: 8 }}>
        <button type="button" onClick={addColor} disabled={pending} className={styles.addBtn} style={{ flex: 1 }}>
          {t("addColor")}
        </button>
      </div>
      {error && <div className={styles.errorText}>{error}</div>}
    </div>
  );
}
