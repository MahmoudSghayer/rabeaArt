import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { LegalSections, type LegalSection } from "./LegalSections";
import styles from "./LegalPageShell.module.css";

export interface LegalPageShellProps {
  active: "terms" | "privacy";
  title: string;
  sections: LegalSection[];
}

/** Shared chrome (tab switcher, title, "last updated", contact box) for /legal/terms and /legal/privacy. */
export async function LegalPageShell({ active, title, sections }: LegalPageShellProps) {
  const t = await getTranslations("legal");
  const tNav = await getTranslations("nav");

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <nav className={styles.tabs} aria-label={title}>
          <Link
            href="/legal/terms"
            aria-current={active === "terms" ? "page" : undefined}
            className={cx(styles.tab, active === "terms" && styles.tabActive)}
          >
            {tNav("terms")}
          </Link>
          <Link
            href="/legal/privacy"
            aria-current={active === "privacy" ? "page" : undefined}
            className={cx(styles.tab, active === "privacy" && styles.tabActive)}
          >
            {tNav("privacy")}
          </Link>
        </nav>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.updated}>{t("updated")}</div>

        <LegalSections sections={sections} />

        <div className={styles.contactBox}>
          {t("contactLine")} <Link href="/contact">{t("contactLink")}</Link>
        </div>
      </div>
    </div>
  );
}
