import { ProductType } from "@/generated/prisma/enums";
import { pickText, type CatalogLocale, type CatalogProductDetail } from "@/lib/catalog/types";
import { productImagePublicUrl } from "@/components/admin/products/productImageUrl";

/**
 * schema.org Product structured data (audit SEO-01).
 *
 * Without this, Google sees a product page as generic HTML: no price, no availability, no
 * currency, and no eligibility for rich results. The data was already being computed for
 * `generateMetadata` on the same page — this just states it in a form crawlers can read.
 *
 * Emitted as a plain <script type="application/ld+json">, which is the format the spec expects
 * and which Next renders server-side with no client JS.
 */

interface Props {
  product: CatalogProductDetail;
  locale: CatalogLocale;
  /** Absolute URL of this product page — schema.org requires absolute, not relative. */
  url: string;
  siteName: string;
}

export function ProductJsonLd({ product, locale, url, siteName }: Props) {
  const name = pickText(product.name, locale);
  const description = pickText(product.description, locale);

  // Absolute image URLs only — a relative path is silently ignored by crawlers.
  const images = product.images.map((img) => productImagePublicUrl(img.path)).filter(Boolean);

  /**
   * Availability is deliberately conservative for paintings. `isOriginal` means one-of-a-kind,
   * so once sold it cannot be restocked — but stock is only tracked for shirts, so we cannot
   * assert InStock for an original we have no stock signal for. Overstating availability is the
   * one error here with a real cost: a customer clicking through to buy something unavailable.
   */
  const availability =
    product.type === ProductType.SHIRT
      ? product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock"
      : "https://schema.org/PreOrder";

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    url,
    ...(description ? { description } : {}),
    ...(images.length > 0 ? { image: images } : {}),
    brand: { "@type": "Brand", name: siteName },
    ...(product.colors.length > 0
      ? { color: product.colors.map((c) => pickText(c.name, locale)).join(", ") }
      : {}),
  };

  // Only claim an offer when there is a real price. A painting mid-setup with no configured
  // size has displayPrice null, and an Offer without a price is invalid structured data —
  // worse than omitting it, because Google reports it as an error against the whole page.
  if (product.displayPrice !== null) {
    jsonLd.offers = {
      "@type": "Offer",
      price: product.displayPrice.toFixed(2),
      priceCurrency: "ILS",
      availability,
      url,
      itemCondition: "https://schema.org/NewCondition",
    };
  }

  return (
    <script
      type="application/ld+json"
      // Content is server-derived from our own database and JSON.stringify escapes it; the `<`
      // replacement additionally prevents a `</script>` sequence inside any field (a product
      // name, say) from closing the tag early.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
