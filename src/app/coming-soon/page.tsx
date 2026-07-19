import type { Metadata } from "next";
import { CONTACT_INFO } from "@/components/storefront/contact-info";
import styles from "./ComingSoon.module.css";

/**
 * Pre-launch holding page. Served for EVERY production URL via the coming-soon gate in
 * src/proxy.ts until launch (see .env.example: COMING_SOON / PREVIEW_KEY). Deliberately
 * outside the [locale] tree with inline bilingual copy: it must render with zero routing,
 * zero DB, and zero message-loading dependencies.
 */
export const metadata: Metadata = {
  title: "Rabea.art — قريبًا · Coming soon",
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  return (
    <div className={styles.wrap} dir="rtl" lang="ar">
      <div className={styles.blobA} aria-hidden />
      <div className={styles.blobB} aria-hidden />
      <main className={styles.card}>
        <span className={styles.badge}>
          <span className={styles.dot} aria-hidden />
          فن يُلبَس وحكايات تُعلَّق
        </span>
        <h1 className={styles.wordmark}>ربيع.</h1>
        <div className={styles.latin} dir="ltr">
          RABEA.ART
        </div>
        <div className={styles.line} aria-hidden />
        <p className={styles.soonAr}>شيء جميل يتجهّز في المرسم — قريبًا</p>
        <p className={styles.soonEn} dir="ltr" lang="en">
          Something beautiful is taking shape in the studio — coming soon.
        </p>
        <p className={styles.sub}>
          قمصان مطبوعة ومطرّزة، لوحات أصلية ونسخ فنية، وطلبات خاصة تبدأ من فكرتك.
        </p>
        <a
          className={styles.ig}
          href={`https://instagram.com/${CONTACT_INFO.instagram.replace(/^@/, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
        >
          Instagram · {CONTACT_INFO.instagram}
        </a>
        <div className={styles.credit} dir="ltr">
          <a href="https://devora.design" target="_blank" rel="noopener noreferrer">
            Made by devora.design
          </a>
        </div>
      </main>
    </div>
  );
}
