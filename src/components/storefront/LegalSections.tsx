import styles from "./LegalSections.module.css";

export interface LegalSection {
  title: string;
  body: string;
}

/**
 * Stable anchor id for the section at `index` (0-based).
 *
 * Shared with LegalPageShell's table of contents — the TOC links to exactly these ids, so the two
 * must never drift. Deriving both from one function is the cheapest way to guarantee that.
 */
export function legalSectionId(index: number): string {
  return `legal-section-${index + 1}`;
}

/** Shared numbered-section renderer for the /legal/terms and /legal/privacy pages. */
export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      {sections.map((section, i) => (
        <section key={i} id={legalSectionId(i)} className={styles.section}>
          <h2 className={styles.heading}>
            {/*
              The numeral is ornament, not content: it repeats the order the document already
              has, and reading "zero one" before every heading is noise. aria-hidden keeps it
              visual — the title itself still carries the meaning.
            */}
            <span className={styles.num} dir="ltr" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className={styles.headingText}>{section.title}</span>
          </h2>
          <p className={styles.body}>{section.body}</p>
        </section>
      ))}
    </>
  );
}
