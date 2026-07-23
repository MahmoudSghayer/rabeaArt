import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { grainedArt } from "@/components/storefront/art";
import { canvasSurface, printSurface } from "@/components/storefront/texture";
import { getCachedFeaturedProducts } from "@/lib/catalog/cached";
import type { CatalogListItem } from "@/lib/catalog/types";
import { ArtMarquee } from "@/components/storefront/ArtMarquee";
import { ProductCard } from "@/components/storefront/ProductCard";
import { AmbientField, MaskReveal, Ornament, TexturedSection, type OrnamentName } from "@/components/decor";
import { Magnetic } from "@/components/motion/Magnetic";
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

/** One ornament per ordering step, so the four cards stop being interchangeable rectangles. */
const STEP_ORNAMENTS: OrnamentName[] = ["spool", "needle", "press", "ribbon"];

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
    featured = await getCachedFeaturedProducts(6);
  } catch {
    featured = [];
  }

  const steps = t.raw("steps") as HowStep[];
  const customSteps = t.raw("customSteps") as CustomStep[];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        {/* Slow colour washes behind the hero — the fix for a first screen that was mostly
            empty paper on the text side. */}
        <AmbientField variant="wash" intensity={0.85} className={styles.heroAmbient} />
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
            {/* The primary action gets the magnetic pull; the secondary links stay still, so the
                emphasis reads rather than everything wobbling at once. */}
            <Magnetic>
              <Link href="/custom" className={cx(buttonStyles.button, buttonStyles.accent)}>
                {t("ctaCustom")}
              </Link>
            </Magnetic>
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
                <div
                  className={styles.polaroidArt}
                  style={{ backgroundImage: canvasSurface(grainedArt("rivers")) }}
                />
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
                <div
                  className={styles.polaroidArtRound}
                  style={{ backgroundImage: printSurface(grainedArt("dawn")) }}
                />
              </div>
            </div>
            <div className={styles.floatCaption2}>
              <span className={styles.floatName}>{t("heroArt2")}</span>
              <span className={styles.embChip}>{t("embTag")}</span>
            </div>
          </ParallaxLayer>

          <ParallaxLayer depth={0.34} className={cx(styles.floatCard, styles.floatCard3)}>
            <div className={styles.polaroidSquare}>
              <div
                className={styles.polaroidArtSquare}
                style={{ backgroundImage: canvasSurface(grainedArt("letters")) }}
              />
            </div>
          </ParallaxLayer>

          {/* A loose thread trailing across the composition, tying the three pieces together. */}
          <span aria-hidden="true" className={styles.heroThread} />
        </div>
      </section>

      <ArtMarquee />

      <TexturedSection tone="paper" glow="ochre" innerClassName={styles.featuredInner}>
        <Reveal index={0}>
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
        </Reveal>

        {featured.length > 0 ? (
          <div className={styles.grid}>
            {featured.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          /* The empty state used to be a bare dashed box on plain paper — the single largest
             dead area on the page whenever the catalogue is still being filled. It is now a
             framed canvas with the studio's own marks, so an empty shop still looks composed. */
          <div className={styles.featuredEmpty}>
            <div aria-hidden="true" className={styles.emptyFrame}>
              <span className={styles.emptyCanvas} style={{ backgroundImage: canvasSurface(grainedArt("still")) }} />
              <Ornament name="brush" size={30} className={styles.emptyMark} />
            </div>
            <p className={styles.featuredEmptyTitle}>{t("featEmptyTitle")}</p>
            <p className={styles.featuredEmptySub}>{t("featEmptySub")}</p>
            <Link href="/shop" className={cx(buttonStyles.button, buttonStyles.outline, buttonStyles.sm)}>
              {t("featAll")}
            </Link>
          </div>
        )}
      </TexturedSection>

      <Reveal as="section" index={1} className={styles.catGrid}>
        <MaskReveal direction="up" index={0} zoom className={styles.catCell}>
          <Link
            href={{ pathname: "/shop", query: { cat: "shirts" } }}
            className={cx(styles.catTile, styles.catTileWide)}
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
        </MaskReveal>

        <MaskReveal direction="up" index={1} zoom className={styles.catCell}>
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
        </MaskReveal>

        {/* Third tile: two tiles left a sparse, unbalanced row on wide screens, and the
            custom-order route — the studio's highest-value path — had no presence here at all. */}
        <MaskReveal direction="up" index={2} zoom className={styles.catCell}>
          <Link href="/custom" className={cx(styles.catTile, styles.catTileCustom)}>
            <span
              aria-hidden="true"
              className={styles.catCustomArt}
              style={{ backgroundImage: grainedArt("custom") }}
            />
            <div className={styles.catOverlay} aria-hidden="true" />
            <div className={styles.catContent}>
              <div>
                <div className={styles.catTitle}>{t("catCustomTitle")}</div>
                <div className={styles.catSub}>{t("catCustomSub")}</div>
              </div>
              <span className={styles.catArrow} aria-hidden="true">
                {t("arrow")}
              </span>
            </div>
          </Link>
        </MaskReveal>
      </Reveal>

      <TexturedSection tone="deep" edge="deckle" glow="teal" innerClassName={styles.howInner}>
        <Reveal index={0}>
          <h2 className={styles.sectionTitle}>{t("howTitle")}</h2>
          <p className={styles.sectionSub}>{t("howSub")}</p>
        </Reveal>

        {/* A connected run of stitches rather than four identical boxes — the connector is what
            turns a grid into a process. */}
        <ol className={styles.stepsGrid}>
          {steps.map((step, i) => (
            <Reveal as="li" key={i} index={i} className={styles.stepCard}>
              <span aria-hidden="true" className={styles.stepConnector} />
              <div className={styles.stepHead}>
                <span className={styles.stepNum} dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={styles.stepIcon}>
                  <Ornament name={STEP_ORNAMENTS[i % STEP_ORNAMENTS.length]} size={19} />
                </span>
              </div>
              <div className={styles.stepTitle}>{step.title}</div>
              <div className={styles.stepDesc}>{step.desc}</div>
            </Reveal>
          ))}
        </ol>

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
      </TexturedSection>

      <section className={styles.customSection}>
        <div className={styles.customBanner}>
          <AmbientField variant="motes" intensity={0.6} className={styles.customAmbient} />
          <div aria-hidden="true" className={styles.customGlowA} />
          <div aria-hidden="true" className={styles.customGlowB} />
          <div className={styles.customInner}>
            <div>
              <div className={styles.customKicker}>
                <Ornament name="star" size={14} strokeWidth={1.6} />
                {t("customKicker")}
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
              {/* The arrow is the whole story of this section: an upload becomes a made thing. */}
              <span aria-hidden="true" className={styles.customArrow}>
                <Ornament name="needle" size={26} />
              </span>
              <div className={styles.customArt2}>
                <div
                  className={styles.customArt2Inner}
                  style={{ backgroundImage: printSurface(grainedArt("saffron")) }}
                />
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
