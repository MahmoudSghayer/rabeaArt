import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { listProducts } from "@/lib/catalog/queries";
import { getCachedActiveOptions } from "@/lib/catalog/cached";
import type { CatalogActiveOptions, ListProductsResult } from "@/lib/catalog/types";
import { grainedArt, type ArtKey } from "@/components/storefront/art";
import { canvasSurface } from "@/components/storefront/texture";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ShopControls } from "@/components/storefront/ShopControls";
import { RecentlyViewed } from "@/components/storefront/RecentlyViewed";
import { Ornament, TexturedSection, type OrnamentName } from "@/components/decor";
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
 * Each category gets its own marks in the hero band — a glyph and two mounted pieces — so
 * /shop?cat=shirts and /shop?cat=paintings differ by more than a swapped heading. Decorative
 * only: everything this band MEANS is carried by the h1 and the subtitle beneath it.
 */
const CATEGORY_DECOR: Record<
  ParsedShopQuery["cat"],
  { ornament: OrnamentName; back: ArtKey; front: ArtKey }
> = {
  all: { ornament: "star", back: "garden", front: "saffron" },
  shirts: { ornament: "fold", back: "dawn", front: "wave" },
  paintings: { ornament: "frame", back: "sea", front: "rivers" },
};

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
  const decor = CATEGORY_DECOR[query.cat];

  return (
    <div className={styles.page}>
      {/*
        The category band. /shop used to open on bare paper — heading, filter bar, cards — which
        made it the flattest page on the site. A linen band with the studio's marks gives the
        category somewhere to live before the grid starts.
      */}
      <TexturedSection
        tone="deep"
        edge="stitch"
        glow="ochre"
        className={styles.heroBand}
        innerClassName={styles.heroInner}
      >
        <div className={styles.heroText}>
          <p className={styles.kicker}>
            <Ornament name="star" size={13} strokeWidth={1.8} className={styles.kickerMark} />
            {t("kicker")}
          </p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
          <Link href="/custom" className={styles.customLink}>
            {t("customLink")}
          </Link>
        </div>

        <div aria-hidden="true" className={styles.heroArt}>
          <span className={cx(styles.heroPlate, styles.heroPlateBack)}>
            <span
              className={styles.heroPlateArt}
              style={{ backgroundImage: canvasSurface(grainedArt(decor.back)) }}
            />
          </span>
          {/*
            The halftone screen on this one is applied in CSS, not via printSurface(): the
            --texture-halftone token carries background POSITION/SIZE, which is shorthand syntax
            and not a valid <image>, so any `background-image` built from it is dropped whole.
          */}
          <span className={cx(styles.heroPlate, styles.heroPlateFront)}>
            <span
              className={cx(styles.heroPlateArt, styles.heroPlateArtPrint)}
              style={{ backgroundImage: grainedArt(decor.front) }}
            />
          </span>
          <span className={styles.heroBadge}>
            <Ornament name={decor.ornament} size={26} strokeWidth={1.4} />
          </span>
        </div>
      </TexturedSection>

      <div className={styles.inner}>
        <ShopControls query={query} activeOptions={activeOptions} />

        <p className={styles.countLine}>
          {t("countLine", { count: result.total })}
          <span aria-hidden="true" className={styles.countRule} />
        </p>

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
          /*
            A composed still-life rather than the shared dashed box. "No results" is exactly the
            moment the shop most needs to look like a studio between pieces instead of a broken
            query, so: two mounted works set aside and a pair of shears, on a grained card.
          */
          <div className={styles.empty}>
            <div aria-hidden="true" className={styles.emptyStack}>
              <span className={cx(styles.emptyPlate, styles.emptyPlateBack)}>
                <span
                  className={styles.emptyArt}
                  style={{ backgroundImage: canvasSurface(grainedArt("still")) }}
                />
              </span>
              <span className={cx(styles.emptyPlate, styles.emptyPlateFront)}>
                <span
                  className={cx(styles.emptyArt, styles.emptyArtPrint)}
                  style={{ backgroundImage: grainedArt("letters") }}
                />
              </span>
              <span className={styles.emptyMark}>
                <Ornament name="scissors" size={22} strokeWidth={1.4} />
              </span>
            </div>
            <p className={styles.emptyTitle}>{t("emptyTitle")}</p>
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
