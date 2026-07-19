import { getTranslations } from "next-intl/server";

/** Placeholder Home page — full hero/featured-products/how-it-works content lands in M2. */
export default async function HomePage() {
  const t = await getTranslations("brand");
  return (
    <main style={{ padding: "var(--space-10)", textAlign: "center" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "48px" }}>{t("wordmark")}</h1>
      <p style={{ color: "var(--color-ink-soft)" }}>{t("tag")}</p>
    </main>
  );
}
