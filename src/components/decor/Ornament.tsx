import { cx } from "@/lib/cx";
import styles from "./Ornament.module.css";

/**
 * The studio's iconographic vocabulary — needle, thread, brush, frame, spool, scissors, fold,
 * press, ribbon, star.
 *
 * Every icon in this codebase is hand-inline SVG (there is no icon dependency and no sprite), so
 * this collects the decorative ones in a single place rather than letting each section invent
 * its own. They are drawn on a shared 24x24 grid with a 1.5 stroke so they sit together at the
 * same optical weight.
 *
 * Two rules, both load-bearing:
 *  - `currentColor` only. An ornament inherits from its context, which is what lets the same
 *    glyph read as sienna on paper, paper on ink, or ochre inside the marquee.
 *  - `aria-hidden` always, and never the only carrier of meaning. These are decoration; if a
 *    glyph needs to say something, put it in adjacent text.
 */

export const ORNAMENTS = {
  /** Sewing needle with an eye — the custom/embroidery marker. */
  needle: (
    <>
      <path d="M20 4 L8 16" />
      <path d="M7 17 L4 20 L6.5 19.5 L7.5 17.5 Z" />
      <ellipse cx="18.4" cy="5.6" rx="1.5" ry="1" transform="rotate(-45 18.4 5.6)" />
    </>
  ),
  /** A loop of thread — used between marquee phrases. */
  thread: (
    <>
      <path d="M3 12 Q7 6 12 12 T21 12" />
      <path d="M3 12 Q7 18 12 12 T21 12" opacity="0.55" />
    </>
  ),
  /** Paint brush, angled as if mid-stroke. */
  brush: (
    <>
      <path d="M18 3 L21 6 L11 16 L8 13 Z" />
      <path d="M8 13 L11 16 L8.5 18.5 Q6 21 3 21 Q4.5 18.5 5 16.5 Z" />
    </>
  ),
  /** Picture frame with a mat — the paintings marker. */
  frame: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <rect x="6.5" y="6.5" width="11" height="11" rx="0.5" opacity="0.55" />
    </>
  ),
  /** Thread spool. */
  spool: (
    <>
      <path d="M7 4 h10 M7 20 h10" />
      <path d="M8.5 4 v16 M15.5 4 v16" />
      <path d="M8.5 8 h7 M8.5 12 h7 M8.5 16 h7" opacity="0.55" />
    </>
  ),
  /** Scissors. */
  scissors: (
    <>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M7.5 16.2 L19 4 M16.5 16.2 L5 4" />
    </>
  ),
  /** A folded garment — the shirts marker. */
  fold: (
    <>
      <path d="M8 3 L4 6 v4 l2.5 -1 V21 h11 V9 l2.5 1 V6 L16 3" />
      <path d="M8 3 q4 3 8 0" opacity="0.55" />
    </>
  ),
  /** Printing press plate. */
  press: (
    <>
      <rect x="3.5" y="5" width="17" height="9" rx="1" />
      <path d="M6.5 14 v5 h11 v-5" />
      <path d="M7 8.5 h10 M7 11 h6" opacity="0.55" />
    </>
  ),
  /** Gift ribbon knot. */
  ribbon: (
    <>
      <path d="M12 8 Q7 3 4.5 6 T12 8 Q17 3 19.5 6 T12 8 Z" />
      <path d="M12 8 v12" />
      <path d="M9 20 l3 -3 l3 3" opacity="0.55" />
    </>
  ),
  /** The design's existing ✺ mark, drawn rather than typed so it scales with stroke weight. */
  star: (
    <>
      <path d="M12 3 v18 M3 12 h18" />
      <path d="M5.6 5.6 L18.4 18.4 M18.4 5.6 L5.6 18.4" opacity="0.6" />
    </>
  ),
} as const;

export type OrnamentName = keyof typeof ORNAMENTS;

export interface OrnamentProps {
  name: OrnamentName;
  /** Edge length in px. Default 24, the grid the paths are drawn on. */
  size?: number;
  /** Stroke weight. Lighter reads more delicate; the marquee uses 1.2. */
  strokeWidth?: number;
  className?: string;
}

export function Ornament({ name, size = 24, strokeWidth = 1.5, className }: OrnamentProps) {
  return (
    <svg
      className={cx(styles.ornament, className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ORNAMENTS[name]}
    </svg>
  );
}
