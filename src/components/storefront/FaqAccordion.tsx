"use client";

import { useId, useState } from "react";
import { cx } from "@/lib/cx";
import styles from "./FaqAccordion.module.css";

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Accessible single-open accordion for the Contact page's FAQ list. Keyboard-operable (native
 * <button>), announces expanded state via aria-expanded/aria-controls.
 *
 * The panel is now ALWAYS mounted, which is a deliberate change: it used to be conditionally
 * rendered, and an element that does not exist cannot animate — every open was an instant jump,
 * on what is the longest block of the site. It animates via `grid-template-rows: 0fr → 1fr`,
 * the only way to transition to a content-driven height without measuring it in JS.
 *
 * Because it stays mounted, the closed state must be hidden from assistive tech as well as from
 * the eye. `visibility: hidden` does both, and it is transition-able — see the CSS for how the
 * delay is sequenced so the text does not vanish before the collapse finishes.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();

  return (
    <div className={styles.list}>
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        const buttonId = `${baseId}-q-${i}`;
        const panelId = `${baseId}-a-${i}`;
        return (
          <div key={i} className={cx(styles.item, isOpen && styles.itemOpen)}>
            <h3 className={styles.heading}>
              <button
                type="button"
                id={buttonId}
                className={styles.trigger}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : i)}
              >
                <span className={styles.question}>{item.q}</span>
                {/*
                  The +/− used to be two different text glyphs swapped on toggle, which cannot
                  animate. Two rules that cross instead: the upright one rotates flat, so the plus
                  becomes a minus in one continuous move.
                */}
                <span className={styles.sign} aria-hidden="true">
                  <span className={styles.signBar} />
                  <span className={cx(styles.signBar, styles.signBarUpright)} />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cx(styles.panel, isOpen && styles.panelOpen)}
            >
              <div className={styles.panelInner}>
                <p className={styles.answer}>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
