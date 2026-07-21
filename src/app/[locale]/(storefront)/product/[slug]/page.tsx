import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ProductType } from "@/generated/prisma/enums";
import { getRelatedProducts } from "@/lib/catalog/queries";
import { getCachedProductBySlug } from "@/lib/catalog/cached";
import { pickText, type CatalogListItem, type CatalogProductDetail } from "@/lib/catalog/types";
import { grainedArt } from "@/components/storefront/art";
import { canvasSurface } from "@/components/storefront/texture";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Ornament, TexturedSection } from "@/components/decor";
import { ProductView } from "./ProductView";
import styles from "./page.module.css";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  let product: CatalogProductDetail | null = null;
  try {
    product = await getCachedProductBySlug(slug);
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
    product = await getCachedProductBySlug(slug);
  } catch {
    fetchFailed = true;
  }

  if (fetchFailed) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          {/* Same composed-still-life treatment as the shop's empty state, not the dashed box. */}
          <div className={styles.unavailable}>
            <div aria-hidden="true" className={styles.unavailableStack}>
              <span className={styles.unavailableFrame}>
                <span
                  className={styles.unavailableArt}
                  style={{ backgroundImage: canvasSurface(grainedArt("still")) }}
                />
              </span>
              <span className={styles.unavailableMark}>
                <Ornament name="brush" size={24} strokeWidth={1.4} />
              </span>
            </div>
            <p className={styles.unavailableTitle}>{t("unavailableTitle")}</p>
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
      </div>

      {/*
        The rail gets its own full-bleed band. It used to start abruptly after a stretch of empty
        paper below the purchase panel, so the page just stopped; a linen band with a stitched
        seam gives the page an ending and separates "this piece" from "other pieces".
      */}
      {related.length > 0 && (
        <TexturedSection
          as="section"
          tone="deep"
          edge="stitch"
          glow="ochre"
          className={styles.relatedBand}
          innerClassName={styles.relatedInner}
        >
          <div className={styles.relatedHead}>
            <span aria-hidden="true" className={styles.relatedMark}>
              <Ornament name={isPaint ? "frame" : "fold"} size={18} strokeWidth={1.5} />
            </span>
            <h2 className={styles.relatedTitle}>{t("related")}</h2>
            <div className={styles.relatedSpacer} />
            <Link href={catHref} className={styles.relatedAll}>
              {t("relatedAll")} <span aria-hidden="true">{t("arrow")}</span>
            </Link>
          </div>
          <div className={styles.relatedGrid}>
            {related.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </div>
        </TexturedSection>
      )}
    </div>
  );
}
