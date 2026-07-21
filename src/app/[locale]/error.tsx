"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import styles from "../error-shell.module.css";

/**
 * Segment error boundary for the localized storefront. Catches render-time exceptions that the
 * pages' own try/catch data guards don't (those cover expected fetch failures and degrade to
 * designed empty states — this covers the unexpected).
 *
 * `digest` is Next.js's server-side error hash: the message itself is withheld from the client
 * in production, so surfacing the digest is what lets a customer's report be matched to the
 * corresponding server log line.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorPage");

  useEffect(() => {
    console.error("[storefront] unhandled render error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div className={styles.wrap}>
      <main className={styles.card}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.body}>{t("body")}</p>
        <div className={styles.actions}>
          <button type="button" onClick={reset} className={styles.button}>
            {t("retry")}
          </button>
          {/* Intentionally a plain <a>, not <Link>: a soft client navigation keeps the same
              React tree alive, so if the failure is in a shared provider it re-throws straight
              back into this boundary. A full document load is the reliable escape hatch. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className={styles.buttonGhost}>
            {t("home")}
          </a>
        </div>
        {error.digest ? <p className={styles.digest}>ref: {error.digest}</p> : null}
      </main>
    </div>
  );
}
