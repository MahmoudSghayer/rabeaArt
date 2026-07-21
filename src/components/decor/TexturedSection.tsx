import type { ElementType, ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./TexturedSection.module.css";

export type SectionTone = "paper" | "deep" | "canvas" | "ink";
export type SectionEdge = "none" | "deckle" | "stitch" | "hairline";
export type SectionGlow = "none" | "sienna" | "ochre" | "teal";

export interface TexturedSectionProps {
  children: ReactNode;
  /** Surface colour + texture pairing. Default "paper" — the page's own surface. */
  tone?: SectionTone;
  /** How the band separates from what precedes it. Default "none". */
  edge?: SectionEdge;
  /** An off-screen coloured glow, for sections that need warmth without an image. */
  glow?: SectionGlow;
  /** Render as something other than <section> to keep semantics correct. */
  as?: ElementType;
  className?: string;
  /** Applied to the inner max-width wrapper rather than the full-bleed band. */
  innerClassName?: string;
  id?: string;
}

/**
 * A full-bleed band with a material surface.
 *
 * This exists to kill the site's most repeated recipe. Before the redesign, three treatments
 * carried every page — `paper-deep + 1px hairline` bands, a dashed empty-state box, and a
 * bordered cream card — so the only rhythm the eye got was flat, flat, flat. Sections now differ
 * by MATERIAL (paper, linen, canvas, ink) and by how their edges are cut, not by nothing.
 *
 * Structure is deliberate: the outer element is full-bleed so the surface reaches both gutters,
 * and an inner wrapper holds the 1280px measure. Every page already hard-codes that pair, so
 * this keeps it in one place.
 *
 * Decorative layers are `aria-hidden` pseudo-elements/divs and never wrap the content, so this
 * adds no landmark and no focusable node — the E2E suite counts both (header nav must stay
 * reachable within 15 tab presses).
 */
export function TexturedSection({
  children,
  tone = "paper",
  edge = "none",
  glow = "none",
  as,
  className,
  innerClassName,
  id,
}: TexturedSectionProps) {
  const Tag = (as ?? "section") as ElementType;

  return (
    <Tag
      id={id}
      className={cx(
        styles.band,
        styles[`tone-${tone}`],
        edge !== "none" && styles[`edge-${edge}`],
        className,
      )}
    >
      {glow !== "none" && <span aria-hidden="true" className={cx(styles.glow, styles[`glow-${glow}`])} />}
      <div className={cx(styles.inner, innerClassName)}>{children}</div>
    </Tag>
  );
}
