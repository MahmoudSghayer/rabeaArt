import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { grainedArt } from "@/components/storefront/art";
import buttonStyles from "@/components/ui/Button.module.css";
import styles from "./page.module.css";

interface AboutValue {
  title: string;
  desc: string;
}

interface TimelineEntry {
  year: string;
  title: string;
  desc: string;
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  const values = t.raw("values") as AboutValue[];
  const timeline = t.raw("timeline") as TimelineEntry[];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.kicker}>✳ {t("kicker")}</div>
          <h1 className={styles.title}>{t("title")}</h1>
          <div className={styles.artistLine} dir="ltr">
            {t("artistLine")}
          </div>
          <p className={styles.intro}>{t("intro1")}</p>
          <p className={styles.intro}>{t("intro2")}</p>
        </div>

        <div className={styles.heroArtWrap}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroFrame}>
            <div
              className={styles.heroArt}
              style={{ backgroundImage: grainedArt("dawn") }}
              role="img"
              aria-label={t("heroImageAlt")}
            />
            <div className={styles.heroCaption} dir="ltr">
              {t("heroCaption")}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.valuesBand}>
        <div className={styles.valuesGrid}>
          {values.map((value, i) => (
            <div key={i} className={styles.valueCard}>
              <div className={styles.valueNum} dir="ltr">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className={styles.valueTitle}>{value.title}</div>
              <div className={styles.valueDesc}>{value.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.story}>
        <h2 className={styles.storyTitle}>{t("storyTitle")}</h2>
        <p className={styles.storyText}>{t("story1")}</p>
        <div className={styles.pullQuote}>
          <span>{t("pull")}</span>
        </div>
        <p className={styles.storyText}>{t("story2")}</p>

        <div className={styles.timeline}>
          {timeline.map((entry, i) => (
            <div key={i} className={styles.timelineRow}>
              <span className={styles.timelineYear} dir="ltr">
                {entry.year}
              </span>
              <div>
                <div className={styles.timelineTitle}>{entry.title}</div>
                <div className={styles.timelineDesc}>{entry.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaBanner}>
          <h2 className={styles.ctaTitle}>{t("ctaTitle")}</h2>
          <p className={styles.ctaSub}>{t("ctaSub")}</p>
          <div className={styles.ctaActions}>
            <Link href="/custom" className={cx(buttonStyles.button, buttonStyles.accent)}>
              {t("ctaCustom")}
            </Link>
            <Link href="/shop" className={cx(buttonStyles.button, buttonStyles.outline)}>
              {t("ctaShop")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
