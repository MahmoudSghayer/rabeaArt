import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { grainedArt } from "@/components/storefront/art";
import { canvasSurface } from "@/components/storefront/texture";
import { AmbientField, Ornament, TexturedSection, type OrnamentName } from "@/components/decor";
import { Reveal } from "@/components/motion/Reveal";
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

/**
 * One mark per value, so the three cards are told apart by a glyph and not only by a numeral —
 * the same device the homepage uses for its ordering steps.
 */
const VALUE_ORNAMENTS: OrnamentName[] = ["needle", "spool", "thread"];

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
        {/* Slow colour washes behind the intro column, which was otherwise bare paper. */}
        <AmbientField variant="wash" intensity={0.7} className={styles.heroAmbient} />

        <div className={styles.heroText}>
          <div className={styles.kicker}>
            <Ornament name="star" size={13} strokeWidth={1.6} />
            {t("kicker")}
          </div>
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
            {/* The portrait stand-in is a stretched canvas now, not a flat gradient — the same
                surface the homepage's floating pieces are painted on. */}
            <div
              className={styles.heroArt}
              style={{ backgroundImage: canvasSurface(grainedArt("dawn")) }}
              role="img"
              aria-label={t("heroImageAlt")}
            />
            <div className={styles.heroCaption} dir="ltr">
              {t("heroCaption")}
            </div>
          </div>
          <span aria-hidden="true" className={styles.heroTack}>
            <Ornament name="brush" size={20} />
          </span>
        </div>
      </section>

      {/*
        The values band used to be the site's most repeated recipe: paper-deep with a hairline top
        and bottom. It is a linen band with a torn edge now, so it differs from its neighbours by
        material rather than by three percent of lightness.
      */}
      <TexturedSection tone="deep" edge="deckle" glow="ochre" innerClassName={styles.valuesInner}>
        <ul className={styles.valuesGrid}>
          {values.map((value, i) => (
            /*
              Reveal owns the entrance (opacity + transform); the card inside owns the hover lift.
              Keeping them on separate elements avoids two modules declaring `transform` and
              `transition` on the same node, where the winner is decided by bundle order.
            */
            <Reveal as="li" key={i} index={i} className={styles.valueCell}>
              <div className={styles.valueCard}>
                <span aria-hidden="true" className={styles.valueMark}>
                  <Ornament name={VALUE_ORNAMENTS[i % VALUE_ORNAMENTS.length]} size={104} strokeWidth={1} />
                </span>
                <div className={styles.valueHead}>
                  <span className={styles.valueNum} dir="ltr">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.valueIcon}>
                    <Ornament name={VALUE_ORNAMENTS[i % VALUE_ORNAMENTS.length]} size={19} />
                  </span>
                </div>
                <div className={styles.valueTitle}>{value.title}</div>
                <div className={styles.valueDesc}>{value.desc}</div>
              </div>
            </Reveal>
          ))}
        </ul>
      </TexturedSection>

      <TexturedSection tone="paper" glow="sienna" innerClassName={styles.storyInner}>
        {/* The story is a sheet resting on the page rather than text floating on it. */}
        <div className={styles.storySheet}>
          <AmbientField variant="threads" intensity={0.5} className={styles.storyAmbient} />

          <div className={styles.storyBody}>
            <Reveal index={0}>
              <h2 className={styles.storyTitle}>{t("storyTitle")}</h2>
              <p className={styles.storyText}>{t("story1")}</p>
            </Reveal>

            <Reveal index={1}>
              <blockquote className={styles.pullQuote}>
                <span aria-hidden="true" className={styles.pullMark}>
                  <Ornament name="brush" size={22} />
                </span>
                <span>{t("pull")}</span>
              </blockquote>
            </Reveal>

            <Reveal index={2}>
              <p className={styles.storyText}>{t("story2")}</p>
            </Reveal>

            {/* A single thread running the length of the list, always paying out. The rows are
                knots tied along it — which is what turns four dated lines into a history. The
                thread sits outside the <ol> because a list may only contain list items. */}
            <div className={styles.timeline}>
              <span aria-hidden="true" className={styles.timelineThread} />
              <ol className={styles.timelineList}>
                {timeline.map((entry, i) => (
                  <Reveal as="li" key={i} index={i} className={styles.timelineRow}>
                    <span aria-hidden="true" className={styles.timelineKnot} />
                    <span className={styles.timelineYear} dir="ltr">
                      {entry.year}
                    </span>
                    <div className={styles.timelineText}>
                      <div className={styles.timelineTitle}>{entry.title}</div>
                      <div className={styles.timelineDesc}>{entry.desc}</div>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </TexturedSection>

      <section className={styles.ctaSection}>
        <div className={styles.ctaBanner}>
          <span aria-hidden="true" className={styles.ctaGlow} />
          <span aria-hidden="true" className={styles.ctaMark}>
            <Ornament name="ribbon" size={34} />
          </span>
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
