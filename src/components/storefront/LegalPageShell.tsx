import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { Ornament, TexturedSection } from "@/components/decor";
import { LegalSections, legalSectionId, type LegalSection } from "./LegalSections";
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
      {/*
        No `glow` prop: TexturedSection parks its glow on the decor layer, above the inner
        content, and its fixed corner is exactly where the table of contents lives — a warm tint
        over six lines of small text is a contrast cost for no gain. This one sits behind the
        title instead, under both columns.
      */}
      <TexturedSection tone="paper" edge="stitch" innerClassName={styles.shell}>
        <span aria-hidden="true" className={styles.shellGlow} />

        <div className={styles.column}>
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

          {/* The clauses sit on a sheet of card stock rather than directly on the page, so the
              document reads as a printed thing. The 780px measure is unchanged. */}
          <div className={styles.sheet}>
            <LegalSections sections={sections} />
          </div>

          <div className={styles.contactBox}>
            <span aria-hidden="true" className={styles.contactMark}>
              <Ornament name="needle" size={20} />
            </span>
            <span>
              {t("contactLine")} <Link href="/contact">{t("contactLink")}</Link>
            </span>
          </div>
        </div>

        {/*
          Margin table of contents. Desktop only — below 1080px it is `display: none`, which also
          takes its links out of the tab order rather than leaving them focusable but invisible.

          A NAMED navigation landmark: a second nav is only a problem for a screen-reader user
          when it is unnamed. `aria-label` (and the visible heading it mirrors) distinguishes it
          from the terms/privacy switcher above, so both announce their purpose.
        */}
        <nav className={styles.toc} aria-label={t("toc")}>
          <div className={styles.tocCard}>
            <p className={styles.tocTitle}>{t("toc")}</p>
            <ol className={styles.tocList}>
              {sections.map((section, i) => (
                <li key={i}>
                  <a href={`#${legalSectionId(i)}`} className={styles.tocLink}>
                    <span className={styles.tocNum} dir="ltr" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.tocText}>{section.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      </TexturedSection>
    </div>
  );
}
