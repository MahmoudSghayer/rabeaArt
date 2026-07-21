"use client";

import { useEffect } from "react";
import styles from "../error-shell.module.css";

/**
 * Admin segment error boundary. Every admin page already try/catches its own data load and
 * renders an in-place failure state, so this catches what those can't: render-time exceptions
 * and anything thrown outside the guarded block.
 *
 * Copy is Arabic (the admin's default locale) with an English line, and deliberately does NOT
 * use next-intl — an error inside the messages provider is one of the things that lands here.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] unhandled render error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <div className={styles.wrap} dir="rtl" lang="ar">
      <main className={styles.card}>
        <h1 className={styles.title}>تعذّر تحميل هذه الصفحة</h1>
        <p className={styles.body}>
          حدث خطأ غير متوقع في لوحة التحكم. جرّب إعادة التحميل، وإن تكرر الخطأ أرسل الرمز أدناه.
        </p>
        <div className={styles.actions}>
          <button type="button" onClick={reset} className={styles.button}>
            إعادة المحاولة
          </button>
          {/* Plain <a> on purpose — see the storefront error boundary: a soft navigation can
              land right back in the broken tree, a document load cannot. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/admin" className={styles.buttonGhost}>
            لوحة التحكم
          </a>
        </div>
        {error.digest ? <p className={styles.digest}>ref: {error.digest}</p> : null}
      </main>
    </div>
  );
}
