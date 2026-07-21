import { getLocale, getTranslations } from "next-intl/server";
import { Ornament, ORNAMENTS, type OrnamentName } from "@/components/decor";
import { cx } from "@/lib/cx";
import styles from "./ArtMarquee.module.css";

interface MarqueePhrase {
  text: string;
  icon: string;
}

export interface ArtMarqueeProps {
  className?: string;
}

/** Falls back to the thread loop if a message file names an icon that doesn't exist. */
function resolveIcon(name: string): OrnamentName {
  return Object.prototype.hasOwnProperty.call(ORNAMENTS, name) ? (name as OrnamentName) : "thread";
}

/**
 * The studio's craft ribbon — two counter-rotating rows of phrases on a woven band.
 *
 * Replaces a strip that was, in the literal sense, a static repeating line: one pre-baked string
 * with the six phrases typed out three times, rendered twice, on a flat fill with a hairline
 * rule. (It also never animated at all, because its keyframe was scoped away — see the note in
 * tokens.css.) Content is now a structured array, so phrases can carry their own ornament and
 * translators edit six strings instead of one 400-character run-on.
 *
 * Direction is the fiddly part. The TRACK is forced `dir="ltr"` so `translateX(-50%)` means the
 * same thing in both locales — otherwise the loop reverses under RTL and the duplicate seam
 * appears mid-band. Each phrase then gets the document's own direction back, so Arabic shapes
 * and orders correctly inside a left-to-right moving track. The previous implementation only got
 * away without this because its whole strip was a single pre-shaped string.
 *
 * Server component: no JS ships. The scroll, the hover-pause and the edge fade are all CSS.
 */
export async function ArtMarquee({ className }: ArtMarqueeProps) {
  const t = await getTranslations("home");
  const locale = await getLocale();
  const dir = locale === "ar" || locale === "he" ? "rtl" : "ltr";

  const phrases = t.raw("marquee") as MarqueePhrase[];

  // Two visually distinct rows from one source: the second is reversed so the pairing of phrase
  // to ornament differs between them, which stops the band reading as one list printed twice.
  const rowA = phrases;
  const rowB = [...phrases].reverse();

  const renderRow = (items: MarqueePhrase[], copy: number) =>
    items.map((phrase, i) => (
      <span className={styles.item} key={`${copy}-${i}-${phrase.text}`}>
        <span className={styles.text} dir={dir}>
          {phrase.text}
        </span>
        <Ornament name={resolveIcon(phrase.icon)} size={15} strokeWidth={1.2} className={styles.mark} />
      </span>
    ));

  return (
    <div className={cx(styles.ribbon, className)}>
      {/*
        aria-label carries the meaning once, and the tracks are hidden — otherwise a screen
        reader would read all six phrases four times over (two rows x two copies).
      */}
      <div className={styles.rows} role="group" aria-label={t("marqueeLabel")}>
        <div className={styles.viewport}>
          <div className={cx(styles.track, styles.trackA)} dir="ltr" aria-hidden="true">
            {/* Two copies: the loop translates by exactly -50%, so copy 2 is mid-band as copy 1
                leaves and the seam never shows. */}
            {renderRow(rowA, 1)}
            {renderRow(rowA, 2)}
          </div>
        </div>

        <div className={styles.viewport}>
          <div className={cx(styles.track, styles.trackB)} dir="ltr" aria-hidden="true">
            {renderRow(rowB, 1)}
            {renderRow(rowB, 2)}
          </div>
        </div>
      </div>
    </div>
  );
}
