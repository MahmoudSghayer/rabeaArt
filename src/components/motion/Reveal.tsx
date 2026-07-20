"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import styles from "./Reveal.module.css";

export interface RevealProps {
  children: ReactNode;
  /** Stagger index — each step delays the entrance by 0.09s, per the design's cascade. */
  index?: number;
  /** Render as something other than a div (e.g. "section", "li") to keep semantics intact. */
  as?: ElementType;
  className?: string;
}

/**
 * Scroll-triggered entrance. The approved design specifies "fadeUp 0.7s ease with a 0.15s
 * stagger — once only", but the original port applied it on mount, so anything below the fold
 * had already finished animating before it was ever seen. This fires as each block scrolls in.
 *
 * "Once only" is honoured literally: the observer disconnects after the first intersection, so
 * scrolling back up never replays it — replaying on every pass is the thing that makes scroll
 * animation feel cheap.
 *
 * Under reduced motion the content renders visible immediately with no transition at all.
 */
export function Reveal({ children, index = 0, as, className }: RevealProps) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Reduced motion is handled entirely in Reveal.module.css, which forces the element visible
    // and untransitioned. Doing it here too would mean a synchronous setState in an effect body
    // (cascading render) for no behavioural gain — the observer below is harmless either way.
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
      // Start slightly before the block reaches the viewport so it is mid-entrance, not
      // popping in, by the time the reader's eye arrives.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={[styles.reveal, shown ? styles.shown : "", className].filter(Boolean).join(" ")}
      style={{ transitionDelay: `${Math.min(index, 6) * 0.09}s` }}
    >
      {children}
    </Tag>
  );
}
