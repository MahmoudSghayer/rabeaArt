"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./MaskReveal.module.css";

export type RevealDirection = "up" | "down" | "start" | "end";

export interface MaskRevealProps {
  children: ReactNode;
  /** Which way the mask sweeps. "start"/"end" are logical, so they follow RTL automatically. */
  direction?: RevealDirection;
  /** Stagger index — matches Reveal's 0.09s cascade so the two can be mixed in one grid. */
  index?: number;
  /** Pair the wipe with a slow scale-down, which is what makes art feel like it settles. */
  zoom?: boolean;
  as?: ElementType;
  className?: string;
}

/**
 * Reveals its children behind a sweeping mask as they scroll into view.
 *
 * Distinct from `Reveal`, which fades a whole block up: this uncovers the content as though a
 * sheet were being drawn off it, which suits artwork and photography where a fade just looks
 * like a slow image load.
 *
 * It mirrors Reveal's proven mechanics rather than inventing new ones — same IntersectionObserver
 * options, same disconnect-after-first-hit ("once only" is honoured literally), same 0.09s
 * stagger capped at 6 — so the two can be interleaved in a single grid without drifting apart.
 *
 * Reduced motion is handled in CSS, matching Reveal's reasoning: doing it in JS as well would
 * mean a synchronous setState in an effect body for no behavioural gain, and the CSS is already
 * correct in the frame before hydration.
 */
export function MaskReveal({
  children,
  direction = "up",
  index = 0,
  zoom = false,
  as,
  className,
}: MaskRevealProps) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cx(
        styles.wrap,
        styles[`dir-${direction}`],
        zoom && styles.zoom,
        shown && styles.shown,
        className,
      )}
      style={{ "--reveal-delay": `${Math.min(index, 6) * 0.09}s` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
