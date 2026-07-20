import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ProductType } from "@/generated/prisma/enums";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog/queries";
import { pickText, type CatalogListItem, type CatalogProductDetail } from "@/lib/catalog/types";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ProductView } from "./ProductView";
import styles from "./page.module.css";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  let product: CatalogProductDetail | null = null;
  try {
    product = await getProductBySlug(slug);
  } catch {
    return {};
  }
  if (!product) return {};

  const catalogLocale = locale === "en" ? "en" : "ar";
  const name = pickText(product.name, catalogLocale);
  const description = pickText(product.description, catalogLocale);
  return {
    title: `${name} — Rabea.art`,
    description: description || undefined,
  };
}

/**
 * Product detail page — server component. Fetches the product by slug plus its same-type
 * related rail, then hands the interactive gallery/purchase panel to the ProductView client
 * component. The runtime DB is unreachable in local dev (placeholder credentials), so both
 * fetches are wrapped in try/catch: a failed product fetch renders a designed "product
 * unavailable" state, a missing/archived slug is a real 404, and a failed related fetch just
 * hides the rail.
 */
export default async function ProductPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("product");
  const tNav = await getTranslations("nav");

  let product: CatalogProductDetail | null = null;
  let fetchFailed = false;
  try {
    product = await getProductBySlug(slug);
  } catch {
    fetchFailed = true;
  }

  if (fetchFailed) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.unavailable}>
            <div className={styles.unavailableGlyph} aria-hidden="true">
              ؟
            </div>
            <div className={styles.unavailableTitle}>{t("unavailableTitle")}</div>
            <p className={styles.unavailableSub}>{t("unavailableSub")}</p>
            <Link href="/shop" className={styles.backToShop}>
              {t("backToShop")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!product) notFound();

  let related: CatalogListItem[] = [];
  try {
    related = await getRelatedProducts(product.id, product.type);
  } catch {
    // Keep the empty default — the rail is simply not rendered.
  }

  const isPaint = product.type === ProductType.PAINTING;
  const catLabel = isPaint ? tNav("paintings") : tNav("shirts");
  const catHref = { pathname: "/shop", query: { cat: isPaint ? "paintings" : "shirts" } };
  const name = pickText(product.name, locale === "en" ? "en" : "ar");

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <nav className={styles.crumbs} aria-label={t("breadcrumbLabel")}>
          <Link href="/shop" className={styles.crumbLink}>
            {tNav("shop")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={catHref} className={styles.crumbLink}>
            {catLabel}
          </Link>
          <span aria-hidden="true">/</span>
          <span className={styles.crumbHere}>{name}</span>
        </nav>

        <ProductView product={product} />

        {related.length > 0 && (
          <section className={styles.relatedSection}>
            <div className={styles.relatedHead}>
              <h2 className={styles.relatedTitle}>{t("related")}</h2>
              <div className={styles.relatedSpacer} />
              <Link href={catHref} className={styles.relatedAll}>
                {t("relatedAll")} {t("arrow")}
              </Link>
            </div>
            <div className={styles.relatedGrid}>
              {related.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
