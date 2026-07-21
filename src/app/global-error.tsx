"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: replaces the ROOT layout, so it must render its own <html>/<body> and
 * cannot rely on anything the root layout provides — no next-intl provider, no fonts, no
 * globals.css tokens. Hence inline styles and inline bilingual copy, matching the same
 * zero-dependency reasoning as the coming-soon page.
 *
 * Arabic-first with an English line beneath, because this can render before a locale is known.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] unhandled error", { digest: error.digest, message: error.message });
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "#f6f0e3",
          color: "#23201b",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: "center",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.75rem", margin: "0 0 0.75rem" }}>حدث خطأ غير متوقع</h1>
          <p style={{ color: "#6b6355", lineHeight: 1.8, margin: "0 0 0.5rem" }}>
            نعتذر — واجهنا مشكلة أثناء تحميل الصفحة. يرجى المحاولة مرة أخرى.
          </p>
          <p dir="ltr" lang="en" style={{ color: "#6b6355", lineHeight: 1.8, margin: "0 0 2rem" }}>
            Something went wrong on our side. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.75rem 1.5rem",
              border: "1px solid #a2553a",
              borderRadius: 999,
              background: "#a2553a",
              color: "#fff3e4",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            إعادة المحاولة · Try again
          </button>
          {error.digest ? (
            <p dir="ltr" style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#6b6355" }}>
              ref: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
