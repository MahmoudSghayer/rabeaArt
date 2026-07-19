"use client";

import { useLocale, useTranslations } from "next-intl";
import type { SupportedLocale } from "@/i18n/routing";
import { setAdminLocaleAction } from "@/app/admin/actions";
import styles from "./HeaderBar.module.css";

/** Reuses the storefront's `header.toggleToAr`/`toggleToEn`/`langToggleTitle` strings (deep-merged
 * into the admin messages tree in admin/layout.tsx) rather than duplicating them. */
export function LanguageToggle() {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("header");
  const next: SupportedLocale = locale === "ar" ? "en" : "ar";
  const setLocale = setAdminLocaleAction.bind(null, next);

  return (
    <form action={setLocale}>
      <button type="submit" className={styles.langToggle} title={t("langToggleTitle")}>
        {locale === "ar" ? t("toggleToEn") : t("toggleToAr")}
      </button>
    </form>
  );
}
