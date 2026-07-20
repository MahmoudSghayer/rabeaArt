import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSettings, listActiveOptions } from "@/lib/catalog/queries";
import type { CatalogActiveOptions } from "@/lib/catalog/types";
import { CustomWizard, type WizardType } from "./CustomWizard";
import { buildWizardOptions } from "./fallback-options";
import styles from "./page.module.css";

/**
 * Custom-order page — server component. Fetches the live option lists + settings (both degrade
 * to the seed-matching fallback in ./fallback-options.ts when the DB is unreachable) and hands
 * everything to the client wizard. `?type=shirt|painting|other` pre-selects a flow, matching
 * the design prototype's URL contract (e.g. the home page "start a custom shirt" CTA).
 */
export default async function CustomPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { type } = await searchParams;
  const typeParam = Array.isArray(type) ? type[0] : type;
  const initialType: WizardType | null =
    typeParam === "shirt" || typeParam === "painting" || typeParam === "other" ? typeParam : null;

  const t = await getTranslations("custom");

  let activeOptions: CatalogActiveOptions | null = null;
  try {
    activeOptions = await listActiveOptions();
  } catch {
    activeOptions = null;
  }

  let customOtherEnabled = true;
  try {
    customOtherEnabled = (await getSettings()).customOtherEnabled;
  } catch {
    // Defaults open — matches DEFAULT_SETTINGS in @/lib/catalog/queries.
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.kicker}>✳ {t("kicker")}</div>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.sub}>{t("sub")}</p>
        </div>

        <div className={styles.priceNotice}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8A6410"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v5" />
            <circle cx="12" cy="16.5" r=".5" fill="#8A6410" />
          </svg>
          <span>{t("priceNotice")}</span>
        </div>

        <CustomWizard
          options={buildWizardOptions(activeOptions)}
          customOtherEnabled={customOtherEnabled}
          initialType={initialType === "other" && !customOtherEnabled ? null : initialType}
        />
      </div>
    </div>
  );
}
