import Link from "next/link";
import { getTranslations } from "next-intl/server";
import styles from "../error-shell.module.css";

/**
 * 404 for the localized storefront. Before this existed, every notFound() — the invalid-locale
 * guard in [locale]/layout.tsx and the unknown-slug branch of the product route — fell through
 * to Next.js's built-in page, which is English, LTR and unstyled: a jarring exit from an
 * Arabic-first site at exactly the moment a visitor is already lost.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className={styles.wrap}>
      <main className={styles.card}>
        <p className={styles.code}>404</p>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.body}>{t("body")}</p>
        <div className={styles.actions}>
          <Link href="/" className={styles.button}>
            {t("home")}
          </Link>
          <Link href="/shop" className={styles.buttonGhost}>
            {t("shop")}
          </Link>
        </div>
      </main>
    </div>
  );
}
