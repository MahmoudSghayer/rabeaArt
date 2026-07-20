"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { SupportedLocale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { toggleMaterialActiveAction, toggleProductionMethodActiveAction } from "./actions";
import styles from "./options.module.css";

export type MaterialRow = { id: string; labelAr: string; labelEn: string; active: boolean };
export type MethodRow = { id: string; scope: string; labelAr: string; labelEn: string; active: boolean };

/** Small data map (not UI copy) for the custom-order wizard's ProductionMethod scopes — see
 * prisma/seed.ts's PRODUCTION_METHOD_SCOPES for the canonical list. An unrecognised scope (added
 * directly in the DB outside this app) falls back to its raw value rather than crashing. */
const SCOPE_LABELS: Record<string, { ar: string; en: string }> = {
  "shirt-method": { ar: "طريقة التنفيذ (قميص)", en: "Shirt method" },
  placement: { ar: "الموضع", en: "Placement" },
  "painting-style": { ar: "أسلوب اللوحة", en: "Painting style" },
  orientation: { ar: "الاتجاه", en: "Orientation" },
  "shirt-type": { ar: "نوع القميص", en: "Shirt type" },
};

function scopeLabel(scope: string, locale: SupportedLocale): string {
  const found = SCOPE_LABELS[scope];
  if (!found) return scope;
  return locale === "ar" ? found.ar : found.en;
}

export function MaterialsMethodsCard({ materials, methods }: { materials: MaterialRow[]; methods: MethodRow[] }) {
  const t = useTranslations("adminOptions");
  const locale = useLocale() as SupportedLocale;

  const [materialItems, setMaterialItems] = useState(materials);
  const [methodItems, setMethodItems] = useState(methods);
  const [pending, startTransition] = useTransition();

  function toggleMaterial(id: string) {
    const target = materialItems.find((i) => i.id === id);
    if (!target) return;
    const next = !target.active;
    setMaterialItems((prev) => prev.map((i) => (i.id === id ? { ...i, active: next } : i)));
    startTransition(async () => {
      const result = await toggleMaterialActiveAction(id, next);
      if (!result.ok) setMaterialItems((prev) => prev.map((i) => (i.id === id ? { ...i, active: !next } : i)));
    });
  }

  function toggleMethod(id: string) {
    const target = methodItems.find((i) => i.id === id);
    if (!target) return;
    const next = !target.active;
    setMethodItems((prev) => prev.map((i) => (i.id === id ? { ...i, active: next } : i)));
    startTransition(async () => {
      const result = await toggleProductionMethodActiveAction(id, next);
      if (!result.ok) setMethodItems((prev) => prev.map((i) => (i.id === id ? { ...i, active: !next } : i)));
    });
  }

  const scopes = [...new Set(methodItems.map((m) => m.scope))];

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{t("materialsMethods")}</div>
      <div className={styles.cardHint}>{t("materialsMethodsHint")}</div>

      <div className={styles.scopeGroup}>
        <div className={styles.scopeLabel}>{t("materials")}</div>
        {materialItems.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => toggleMaterial(m.id)}
            disabled={pending}
            className={styles.methodRow}
          >
            <span className={styles.methodDot} style={{ background: m.active ? "#3F7048" : "#C9C2B2" }} />
            <span className={cx(!m.active && styles.listLabelInactive)}>{locale === "ar" ? m.labelAr : m.labelEn}</span>
          </button>
        ))}
      </div>

      {scopes.map((scope) => (
        <div key={scope} className={styles.scopeGroup}>
          <div className={styles.scopeLabel}>{scopeLabel(scope, locale)}</div>
          {methodItems
            .filter((m) => m.scope === scope)
            .map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMethod(m.id)}
                disabled={pending}
                className={styles.methodRow}
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "start", padding: "5px 0" }}
              >
                <span className={styles.methodDot} style={{ background: m.active ? "#3F7048" : "#C9C2B2" }} />
                <span className={cx(!m.active && styles.listLabelInactive)}>{locale === "ar" ? m.labelAr : m.labelEn}</span>
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
