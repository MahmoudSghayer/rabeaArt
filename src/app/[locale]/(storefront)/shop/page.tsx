import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { listProducts } from "@/lib/catalog/queries";
import { getCachedActiveOptions } from "@/lib/catalog/cached";
import type { CatalogActiveOptions, ListProductsResult } from "@/lib/catalog/types";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ShopControls } from "@/components/storefront/ShopControls";
import { RecentlyViewed } from "@/components/storefront/RecentlyViewed";
import {
  buildShopQuery,
  categoryToProductType,
  parseShopQuery,
  SHOP_PAGE_SIZE,
  type ParsedShopQuery,
  type RawShopSearchParams,
} from "@/components/storefront/shop-query";
import styles from "./page.module.css";

/**
 * Shop page — server component. Reads `searchParams` (see `shop-query.ts` for the full URL
 * contract), fetches the matching page of products, and renders. `listProducts`/
 * `listActiveOptions` throw against the current dev DB (placeholder credentials), so both calls
 * are wrapped in try/catch: a failed product query degrades to the same "no results" empty
 * state as a real zero-match search, and a failed options query just hides the filter groups
 * that depend on it (category tabs/search/sort keep working either way).
 */
export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawShopSearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const rawSearchParams = await searchParams;
  const query = parseShopQuery(rawSearchParams);

  const t = await getTranslations("shop");

  let result: ListProductsResult = { items: [], total: 0, page: 1, pageCount: 0 };
  try {
    result = await listProducts({
      type: categoryToProductType(query.cat),
      search: query.q || undefined,
      colorCode: query.color || undefined,
      sizeCode: query.size || undefined,
      priceBucket: query.price || undefined,
      inStockOnly: query.stock || undefined,
      sort: query.sort,
      page: query.page,
      pageSize: SHOP_PAGE_SIZE,
    });
  } catch {
    // Keep the zero-result default — renders the same empty state as a real "no matches".
  }

  let activeOptions: CatalogActiveOptions | null = null;
  try {
    activeOptions = await getCachedActiveOptions();
  } catch {
    activeOptions = null;
  }

  const titles: Record<ParsedShopQuery["cat"], { title: string; subtitle: string }> = {
    all: { title: t("titleAll"), subtitle: t("subtitleAll") },
    shirts: { title: t("titleShirts"), subtitle: t("subtitleShirts") },
    paintings: { title: t("titlePaintings"), subtitle: t("subtitlePaintings") },
  };
  const { title, subtitle } = titles[query.cat];
  const hasResults = result.items.length > 0;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.headerRow}>
          <div>
            <div className={styles.kicker}>✳ {t("kicker")}</div>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
          <div className={styles.headerSpacer} />
          <Link href="/custom" className={styles.customLink}>
            {t("customLink")}
          </Link>
        </div>

        <ShopControls query={query} activeOptions={activeOptions} />

        <div className={styles.countLine}>{t("countLine", { count: result.total })}</div>

        {hasResults ? (
          <>
            <div className={styles.grid}>
              {result.items.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
            {result.pageCount > 1 && (
              <ShopPagination
                query={query}
                pageCount={result.pageCount}
                prevLabel={t("prevPage")}
                nextLabel={t("nextPage")}
                pageAriaLabel={(page) => t("pageLabel", { page, total: result.pageCount })}
              />
            )}
          </>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyGlyph} aria-hidden="true">
              ؟
            </div>
            <div className={styles.emptyTitle}>{t("emptyTitle")}</div>
            <p className={styles.emptySub}>{t("emptySub")}</p>
            <Link href="/shop" className={styles.emptyReset}>
              {t("reset")}
            </Link>
          </div>
        )}

        <RecentlyViewed />
      </div>
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

function ShopPagination({
  query,
  pageCount,
  prevLabel,
  nextLabel,
  pageAriaLabel,
}: {
  query: ParsedShopQuery;
  pageCount: number;
  prevLabel: string;
  nextLabel: string;
  pageAriaLabel: (page: number) => string;
}) {
  const current = Math.min(Math.max(query.page, 1), pageCount);
  const hrefFor = (page: number) => ({ pathname: "/shop", query: buildShopQuery({ ...query, page }) });

  return (
    <nav className={styles.pagination} aria-label={prevLabel + " / " + nextLabel}>
      {current > 1 ? (
        <Link href={hrefFor(current - 1)} className={styles.pageArrow}>
          {prevLabel}
        </Link>
      ) : (
        <span className={cx(styles.pageArrow, styles.pageArrowDisabled)} aria-disabled="true">
          {prevLabel}
        </span>
      )}

      <div className={styles.pageNumbers}>
        {getPageNumbers(current, pageCount).map((entry, i) =>
          entry === "ellipsis" ? (
            <span key={`ellipsis-${i}`} className={styles.pageEllipsis} aria-hidden="true">
              …
            </span>
          ) : (
            <Link
              key={entry}
              href={hrefFor(entry)}
              aria-current={entry === current ? "page" : undefined}
              aria-label={pageAriaLabel(entry)}
              className={cx(styles.pageNum, entry === current && styles.pageNumActive)}
            >
              {entry}
            </Link>
          ),
        )}
      </div>

      {current < pageCount ? (
        <Link href={hrefFor(current + 1)} className={styles.pageArrow}>
          {nextLabel}
        </Link>
      ) : (
        <span className={cx(styles.pageArrow, styles.pageArrowDisabled)} aria-disabled="true">
          {nextLabel}
        </span>
      )}
    </nav>
  );
}
