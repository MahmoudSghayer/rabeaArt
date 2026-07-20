"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ProductType } from "@/generated/prisma/enums";
import { artKeyForId, formatMoney } from "@/components/admin/format";
import { grainedArt } from "@/components/storefront/art";
import type { SupportedLocale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { productImagePublicUrl } from "@/components/admin/products/productImageUrl";
import { toggleFeaturedAction } from "./actions";
import styles from "./ProductsGrid.module.css";

export type ProductCardRow = {
  id: string;
  slug: string;
  type: ProductType;
  nameAr: string;
  nameEn: string;
  categoryNameAr: string;
  categoryNameEn: string;
  imagePath: string | null;
  price: number | null;
  sale: number | null;
  /** Cheapest configured painting size price, or null. */
  fromPrice: number | null;
  /** Sum of active variant stock for tracked shirts; null otherwise ("—" pill). */
  stock: number | null;
  featured: boolean;
  archived: boolean;
};

export interface ProductsGridProps {
  rows: ProductCardRow[];
  total: number;
  page: number;
  pageSize: number;
  baseQuery: string;
}

function pageHref(baseQuery: string, page: number): string {
  const qs = baseQuery ? `${baseQuery}&page=${page}` : `page=${page}`;
  return `/admin/products?${qs}`;
}

function storeHref(locale: SupportedLocale, slug: string): string {
  return locale === "en" ? `/en/product/${slug}` : `/product/${slug}`;
}

function ProductCard({ row }: { row: ProductCardRow }) {
  const t = useTranslations("adminProducts");
  const tCommon = useTranslations("adminCommon");
  const locale = useLocale() as SupportedLocale;

  const [featured, setFeatured] = useState(row.featured);
  const [pending, startTransition] = useTransition();

  function onToggleFeatured() {
    const next = !featured;
    setFeatured(next);
    startTransition(async () => {
      const result = await toggleFeaturedAction(row.id, next);
      if (!result.ok) setFeatured(!next);
    });
  }

  const name = locale === "ar" ? row.nameAr : row.nameEn;
  const categoryName = locale === "ar" ? row.categoryNameAr : row.categoryNameEn;
  const isPainting = row.type === "PAINTING";
  const priceLine = isPainting
    ? row.fromPrice !== null
      ? `${t("fromPrice")} ${formatMoney(row.fromPrice, tCommon("na"))}`
      : tCommon("na")
    : formatMoney(row.sale ?? row.price, tCommon("na"));

  const stockLabel = row.stock === null ? tCommon("na") : row.stock > 0 ? t("inStock", { count: row.stock }) : t("outOfStock");
  const thumbStyle = row.imagePath
    ? { backgroundImage: `url(${productImagePublicUrl(row.imagePath)})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundImage: grainedArt(artKeyForId(row.id)) };

  return (
    <div className={cx(styles.card, row.archived && styles.cardArchived)}>
      <div className={styles.cardHead}>
        <span className={styles.thumb} style={thumbStyle} />
        <div className={styles.cardInfo}>
          <div className={styles.name}>{name}</div>
          <div className={styles.categoryPrice}>
            {categoryName} · {priceLine}
          </div>
          <div className={styles.badges}>
            {row.stock !== null && (
              <span className={cx(styles.badge, row.stock > 0 ? styles.badgeStockOk : styles.badgeStockOut)}>
                {stockLabel}
              </span>
            )}
            {featured && <span className={cx(styles.badge, styles.badgeFeatured)}>★ {t("featured")}</span>}
            {row.archived && <span className={cx(styles.badge, styles.badgeArchived)}>{t("archived")}</span>}
          </div>
        </div>
      </div>
      <div className={styles.actions}>
        <Link href={`/admin/products/${row.id}/edit`} className={styles.editBtn}>
          {t("edit")}
        </Link>
        <button
          type="button"
          title={t("featured")}
          onClick={onToggleFeatured}
          disabled={pending}
          className={cx(styles.iconBtn, featured && styles.iconBtnActive)}
        >
          ★
        </button>
        <a
          href={storeHref(locale, row.slug)}
          target="_blank"
          rel="noreferrer"
          title={t("viewInStore")}
          className={styles.iconBtn}
        >
          ↗
        </a>
      </div>
    </div>
  );
}

export function ProductsGrid({ rows, total, page, pageSize, baseQuery }: ProductsGridProps) {
  const t = useTranslations("adminProducts");
  const tCommon = useTranslations("adminCommon");
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className={styles.grid}>
        {rows.map((row) => (
          <ProductCard key={row.id} row={row} />
        ))}
      </div>

      {rows.length === 0 && <div className={styles.empty}>{t("noMatches")}</div>}

      {pageCount > 1 && (
        <div className={styles.pagination}>
          <Link
            href={pageHref(baseQuery, Math.max(1, page - 1))}
            className={cx(styles.pageBtn, page <= 1 && styles.pageBtnDisabled)}
            aria-disabled={page <= 1}
          >
            {tCommon("previous")}
          </Link>
          <span className={styles.pageInfo}>
            {tCommon("page")} {page} {tCommon("of")} {pageCount}
          </span>
          <Link
            href={pageHref(baseQuery, Math.min(pageCount, page + 1))}
            className={cx(styles.pageBtn, page >= pageCount && styles.pageBtnDisabled)}
            aria-disabled={page >= pageCount}
          >
            {tCommon("next")}
          </Link>
        </div>
      )}
    </>
  );
}
