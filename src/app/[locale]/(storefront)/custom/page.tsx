import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCachedActiveOptions, getCachedSettings } from "@/lib/catalog/cached";
import type { CatalogActiveOptions } from "@/lib/catalog/types";
import { grainedArt } from "@/components/storefront/art";
import { canvasSurface, printSurface, textured } from "@/components/storefront/texture";
import { AmbientField, Ornament, TexturedSection, type OrnamentName } from "@/components/decor";
import { Reveal } from "@/components/motion/Reveal";
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
  const tCommon = await getTranslations("common");
  const tActions = await getTranslations("actions");
  const tHome = await getTranslations("home");

  let activeOptions: CatalogActiveOptions | null = null;
  try {
    activeOptions = await getCachedActiveOptions();
  } catch {
    activeOptions = null;
  }

  let customOtherEnabled = true;
  try {
    customOtherEnabled = (await getCachedSettings()).customOtherEnabled;
  } catch {
    // Defaults open — matches DEFAULT_SETTINGS in @/lib/catalog/queries.
  }

  /**
   * The storyboard: an idea becoming a finished piece, in five beats.
   *
   * Built exactly as the homepage's ordering-steps block is built — an <ol> of connected cards,
   * a stitched connector running along the inline axis, one ornament per step — rather than as a
   * second, competing pattern. What is new is that the MATERIAL advances with the story: a bare
   * upload, then a woven garment, then dyed cloth, then a pulled print, then a stretched canvas.
   * By the last panel the page has already shown you what it is going to make.
   *
   * Every label is an EXISTING translation key. No new copy was introduced for this block.
   */
  const homeCustomSteps = tHome.raw("customSteps") as Array<{ label: string }>;
  const storyboard: Array<{ label: string; ornament: OrnamentName; art: string }> = [
    {
      label: homeCustomSteps[0]?.label ?? "",
      ornament: "frame",
      art: textured(grainedArt("custom"), "grain"),
    },
    {
      label: t("review.requestType"),
      ornament: "fold",
      art: textured(grainedArt("dawn"), "weaveSoft", "grain"),
    },
    {
      label: `${tCommon("size")} · ${tCommon("color")}`,
      ornament: "spool",
      art: textured(grainedArt("saffron"), "linen"),
    },
    {
      label: tCommon("method"),
      ornament: "press",
      art: printSurface(grainedArt("letters")),
    },
    {
      label: tActions("submitOrder"),
      ornament: "ribbon",
      art: canvasSurface(grainedArt("rivers")),
    },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.headBand}>
        <AmbientField variant="wash" intensity={0.5} className={styles.headAmbient} />
        <div className={styles.headInner}>
          <div className={styles.kicker}>
            <Ornament name="star" size={13} strokeWidth={1.6} />
            {t("kicker")}
          </div>
          <h1 className={styles.title}>{t("title")}</h1>
          <p className={styles.sub}>{t("sub")}</p>
        </div>
      </section>

      <TexturedSection tone="deep" edge="deckle" glow="ochre" innerClassName={styles.boardInner}>
        <ol className={styles.board}>
          {storyboard.map((beat, i) => (
            <Reveal as="li" key={beat.label} index={i} className={styles.beat}>
              <span aria-hidden="true" className={styles.beatConnector} />
              {/*
                `background`, not `backgroundImage`: printSurface() layers the halftone screen,
                whose value carries its own `position / size` pair (see --texture-halftone in
                textures.css), and that pair is only legal in the background SHORTHAND. Assigned
                to background-image the declaration is dropped outright and the panel renders
                empty — with correct opacity and dimensions, which is what makes it so easy to
                miss.
              */}
              <span
                aria-hidden="true"
                className={styles.beatArt}
                style={{ background: beat.art, animationDelay: `${i * 0.5}s` }}
              />
              <div className={styles.beatHead}>
                <span className={styles.beatNum} dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={styles.beatIcon}>
                  <Ornament name={beat.ornament} size={18} />
                </span>
              </div>
              <div className={styles.beatLabel}>{beat.label}</div>
            </Reveal>
          ))}
        </ol>
      </TexturedSection>

      <section className={styles.inner}>
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
      </section>
    </div>
  );
}
