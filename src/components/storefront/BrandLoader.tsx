import Image from "next/image";
import styles from "./BrandLoader.module.css";

/**
 * Full-viewport brand loading screen: the Rabea.art signature mark centred on paper, encircled
 * by a rotating brush-sweep arc and a breathing warm halo, over the same handmade-paper surface
 * as the rest of the site so the wait feels like part of the studio rather than a blank gap.
 *
 * Presentational and locale-agnostic on purpose — the caller passes the already-translated
 * `label` so this stays a zero-JS Server Component (no next-intl hook, nothing hydrated). It is
 * mounted from [locale]/loading.tsx, i.e. as the Suspense fallback for the whole storefront, so
 * it renders instantly while a page streams in and is swapped out the moment content is ready.
 *
 * All keyframes live in the sibling module: Lightning CSS scopes every animation-name inside a
 * .module.css, so referencing a keyframe declared in a global stylesheet would compile to a
 * prefixed name that matches nothing and silently never run (see the note in tokens.css).
 * Motion is also reduced-motion safe: the resting styles below the keyframes are the visible
 * state, so when the global prefers-reduced-motion rule collapses every animation the mark still
 * shows clean, centred and legible.
 */
export function BrandLoader({ label }: { label: string }) {
  return (
    <div className={styles.stage} role="status">
      <span className={styles.blobA} aria-hidden />
      <span className={styles.blobB} aria-hidden />

      <div className={styles.emblem}>
        <span className={styles.ring} aria-hidden />
        {/* Empty alt: the mark is decorative here — the localized caption below carries meaning. */}
        <Image
          src="/logo-mark.png"
          alt=""
          width={368}
          height={240}
          className={styles.mark}
          priority
        />
      </div>

      <p className={styles.label}>{label}</p>

      <span className={styles.track} aria-hidden>
        <span className={styles.trackFill} />
      </span>
    </div>
  );
}
