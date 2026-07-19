import styles from "./LegalSections.module.css";

export interface LegalSection {
  title: string;
  body: string;
}

/** Shared numbered-section renderer for the /legal/terms and /legal/privacy pages. */
export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <>
      {sections.map((section, i) => (
        <section key={i} className={styles.section}>
          <h2 className={styles.heading}>
            <span className={styles.num} dir="ltr">
              {String(i + 1).padStart(2, "0")}
            </span>
            {section.title}
          </h2>
          <p className={styles.body}>{section.body}</p>
        </section>
      ))}
    </>
  );
}
