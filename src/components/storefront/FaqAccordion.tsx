"use client";

import { useId, useState } from "react";
import styles from "./FaqAccordion.module.css";

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Accessible single-open accordion for the Contact page's FAQ list. Keyboard-operable (native
 * <button>), announces expanded state via aria-expanded/aria-controls, and the answer panel is
 * only mounted while open.
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
          <div key={i} className={styles.item}>
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
                <span className={styles.sign} aria-hidden="true">
                  {isOpen ? "–" : "+"}
                </span>
              </button>
            </h3>
            {isOpen && (
              <p id={panelId} role="region" aria-labelledby={buttonId} className={styles.answer}>
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
