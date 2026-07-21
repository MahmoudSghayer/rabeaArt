import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { grainedArt } from "@/components/storefront/art";
import { getFeaturedProducts } from "@/lib/catalog/queries";
import type { CatalogListItem } from "@/lib/catalog/types";
import { ArtMarquee } from "@/components/storefront/ArtMarquee";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { Reveal } from "@/components/motion/Reveal";
import buttonStyles from "@/components/ui/Button.module.css";
import styles from "./page.module.css";

interface HowStep {
  title: string;
  desc: string;
}

interface CustomStep {
  label: string;
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tCommon = await getTranslations("common");

  // getFeaturedProducts throws against the current dev DB (placeholder credentials) — the
  // section degrades to its own empty-state copy instead of crashing the page.
  let featured: CatalogListItem[] = [];
  try {
    featured = await getFeaturedProducts(6);
  } catch {
    featured = [];
  }

  const steps = t.raw("steps") as HowStep[];
  const customSteps = t.raw("customSteps") as CustomStep[];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div aria-hidden="true" className={styles.heroGlowA} />
        <div aria-hidden="true" className={styles.heroGlowB} />

        <div className={styles.heroText}>
          <div className={styles.kicker}>
            <span className={styles.kickerDot} aria-hidden="true" />
            {t("kicker")}
          </div>
          <h1 className={styles.title}>
            {t("heroA")}
            <br />
            <span className={styles.titleAccent}>{t("heroB")}</span>
          </h1>
          <div className={styles.heroEcho} dir="ltr">
            {t("heroEcho")}
          </div>
          <p className={styles.heroSub}>{t("heroSub")}</p>
          <div className={styles.ctaRow}>
            <Link
              href={{ pathname: "/shop", query: { cat: "shirts" } }}
              className={cx(buttonStyles.button, buttonStyles.primary)}
            >
              {t("ctaShirts")}
            </Link>
            <Link
              href={{ pathname: "/shop", query: { cat: "paintings" } }}
              className={cx(buttonStyles.button, buttonStyles.outline)}
            >
              {t("ctaPaint")}
            </Link>
            <Link href="/custom" className={cx(buttonStyles.button, buttonStyles.accent)}>
              {t("ctaCustom")}
            </Link>
          </div>
          <div className={styles.trust}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#33605A"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={styles.trustIcon}
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span>{t("trust")}</span>
          </div>
        </div>

        <div className={styles.heroArt} role="img" aria-label={t("heroArt1") + " · " + t("heroArt2")}>
          {/* Depths differ per card so the three pieces separate as the pointer moves — the
              nearest drifts furthest, which is what sells the depth. */}
          <ParallaxLayer depth={1} className={cx(styles.floatCard, styles.floatCard1)}>
            <div className={styles.polaroidDark}>
              <div className={styles.polaroidInner}>
                <div className={styles.polaroidArt} style={{ backgroundImage: grainedArt("rivers") }} />
              </div>
            </div>
            <div className={styles.floatCaption1}>
              <span className={styles.floatName}>{t("heroArt1")}</span>
              <span className={styles.floatMeta}>A3 · {t("origTag")}</span>
            </div>
          </ParallaxLayer>

          <ParallaxLayer depth={0.62} className={cx(styles.floatCard, styles.floatCard2)}>
            <div className={styles.polaroidDashed}>
              <div className={styles.polaroidInnerRound}>
                <div className={styles.polaroidArtRound} style={{ backgroundImage: grainedArt("dawn") }} />
              </div>
            </div>
            <div className={styles.floatCaption2}>
              <span className={styles.floatName}>{t("heroArt2")}</span>
              <span className={styles.embChip}>{t("embTag")}</span>
            </div>
          </ParallaxLayer>

          <ParallaxLayer depth={0.34} className={cx(styles.floatCard, styles.floatCard3)}>
            <div className={styles.polaroidSquare}>
              <div className={styles.polaroidArtSquare} style={{ backgroundImage: grainedArt("letters") }} />
            </div>
          </ParallaxLayer>
        </div>
      </section>

      <ArtMarquee />

      <Reveal as="section" index={0} className={styles.featured}>
        <div className={styles.sectionHeadRow}>
          <div>
            <h2 className={styles.sectionTitle}>{t("featTitle")}</h2>
            <p className={styles.sectionSub}>{t("featSub")}</p>
          </div>
          <div className={styles.sectionSpacer} />
          <Link href="/shop" className={styles.sectionLink}>
            {t("featAll")} {t("arrow")}
          </Link>
        </div>

        {featured.length > 0 ? (
          <div className={styles.grid}>
            {featured.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className={styles.featuredEmpty}>
            <p className={styles.featuredEmptyTitle}>{t("featEmptyTitle")}</p>
            <p className={styles.featuredEmptySub}>{t("featEmptySub")}</p>
          </div>
        )}
      </Reveal>

      <Reveal as="section" index={1} className={styles.catGrid}>
        <Link
          href={{ pathname: "/shop", query: { cat: "shirts" } }}
          className={styles.catTile}
          style={{ backgroundImage: grainedArt("garden") }}
        >
          <div className={styles.catOverlay} aria-hidden="true" />
          <div className={styles.catContent}>
            <div>
              <div className={styles.catTitle}>{t("catShirtTitle")}</div>
              <div className={styles.catSub}>{t("catShirtSub")}</div>
            </div>
            <span className={styles.catArrow} aria-hidden="true">
              {t("arrow")}
            </span>
          </div>
        </Link>
        <Link
          href={{ pathname: "/shop", query: { cat: "paintings" } }}
          className={styles.catTile}
          style={{ backgroundImage: grainedArt("sea") }}
        >
          <div className={styles.catOverlay} aria-hidden="true" />
          <div className={styles.catContent}>
            <div>
              <div className={styles.catTitle}>{t("catPaintTitle")}</div>
              <div className={styles.catSub}>{t("catPaintSub")}</div>
            </div>
            <span className={styles.catArrow} aria-hidden="true">
              {t("arrow")}
            </span>
          </div>
        </Link>
      </Reveal>

      <Reveal as="section" index={0} className={styles.howBand}>
        <div className={styles.howInner}>
          <h2 className={styles.sectionTitle}>{t("howTitle")}</h2>
          <p className={styles.sectionSub}>{t("howSub")}</p>
          <div className={styles.stepsGrid}>
            {steps.map((step, i) => (
              <div key={i} className={styles.stepCard}>
                <div className={styles.stepNum} dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className={styles.stepTitle}>{step.title}</div>
                <div className={styles.stepDesc}>{step.desc}</div>
              </div>
            ))}
          </div>
          <div className={styles.payNote}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#B7472A"
              strokeWidth="2"
              aria-hidden="true"
              className={styles.payNoteIcon}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v5" />
              <circle cx="12" cy="16.5" r=".5" fill="#B7472A" />
            </svg>
            <span>{tCommon("payNote")}</span>
          </div>
        </div>
      </Reveal>

      <section className={styles.customSection}>
        <div className={styles.customBanner}>
          <div aria-hidden="true" className={styles.customGlowA} />
          <div aria-hidden="true" className={styles.customGlowB} />
          <div className={styles.customInner}>
            <div>
              <div className={styles.customKicker}>
                ✳ {t("customKicker")}
              </div>
              <h2 className={styles.customTitle}>{t("customTitle")}</h2>
              <p className={styles.customSub}>{t("customSub")}</p>
              <div className={styles.customStepsRow}>
                {customSteps.map((step, i) => (
                  <span key={i} className={styles.customStepChip}>
                    <span className={styles.customStepNum} dir="ltr">
                      {i + 1}
                    </span>
                    {step.label}
                  </span>
                ))}
              </div>
              <div className={styles.customActions}>
                <Link href="/custom" className={cx(buttonStyles.button, buttonStyles.accent)}>
                  {t("customCta")}
                </Link>
                <Link href="/shop" className={styles.customOutlineLink}>
                  {t("featAll")}
                </Link>
              </div>
            </div>

            <div className={styles.customArtWrap}>
              <div className={styles.customArt1}>
                <div className={styles.customArt1Inner} style={{ backgroundImage: grainedArt("custom") }} />
                <div className={styles.customArt1Caption}>
                  <span dir="ltr">your-idea.jpg</span>
                  <span dir="ltr">1.2 MB</span>
                </div>
              </div>
              <div className={styles.customArt2}>
                <div className={styles.customArt2Inner} style={{ backgroundImage: grainedArt("saffron") }} />
                <div className={styles.customArt2Caption}>
                  <span>{t("customAfter")}</span>
                  <span className={styles.checkMark} aria-hidden="true">
                    ✓
                  </span>
                </div>
              </div>
              <div className={styles.customNoteChip}>{t("customNoteChip")}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
