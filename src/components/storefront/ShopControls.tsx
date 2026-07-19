"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { SupportedLocale } from "@/i18n/routing";
import { pickText, type CatalogActiveOptions, type CatalogSizeOption } from "@/lib/catalog/types";
import { Chip } from "@/components/ui/Chip";
import { cx } from "@/lib/cx";
import { buildShopQuery, type ParsedShopQuery, type ShopCategoryParam } from "./shop-query";
import styles from "./ShopControls.module.css";

export interface ShopControlsProps {
  query: ParsedShopQuery;
  /** null when `listActiveOptions()` failed — filter groups that need it are hidden. */
  activeOptions: CatalogActiveOptions | null;
}

const CATS: ShopCategoryParam[] = ["all", "shirts", "paintings"];
const BUCKETS = ["a", "b", "c"] as const;
const SEARCH_DEBOUNCE_MS = 300;

function dedupeSizes(list: CatalogSizeOption[]): CatalogSizeOption[] {
  const seen = new Set<string>();
  const out: CatalogSizeOption[] = [];
  for (const item of list) {
    if (!seen.has(item.code)) {
      seen.add(item.code);
      out.push(item);
    }
  }
  return out;
}

/**
 * All Shop filter/sort/search/tab controls. Writes every change straight to the URL via
 * `router.replace` — this component holds no filter state of its own beyond the search input's
 * in-progress text (debounced) and whether the filters drawer is open (pure UI state, not part
 * of the URL contract).
 */
export function ShopControls({ query, activeOptions }: ShopControlsProps) {
  const router = useRouter();
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("shop");

  const [searchValue, setSearchValue] = useState(query.q);
  // Mirrors `query.q` into local state without an effect (see "Adjusting state when a prop
  // changes" in the React docs) — this keeps the input in sync when the URL changes from
  // elsewhere (back/forward, a reset link) while still allowing free typing in between.
  const [syncedQ, setSyncedQ] = useState(query.q);
  if (query.q !== syncedQ) {
    setSyncedQ(query.q);
    setSearchValue(query.q);
  }

  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const navigate = useCallback(
    (patch: Partial<ParsedShopQuery>) => {
      const next = { ...query, ...patch };
      router.replace({ pathname: "/shop", query: buildShopQuery(next) }, { scroll: false });
    },
    [query, router],
  );

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ q: value, page: 1 });
    }, SEARCH_DEBOUNCE_MS);
  }

  function pickCat(cat: ShopCategoryParam) {
    if (cat === query.cat) return;
    // Size chips are scoped per category — drop a stale selection when switching.
    navigate({ cat, size: "", page: 1 });
  }

  const catLabels: Record<ShopCategoryParam, string> = {
    all: t("catAll"),
    shirts: t("catShirts"),
    paintings: t("catPaintings"),
  };

  const bucketLabels: Record<(typeof BUCKETS)[number], string> = {
    a: t("priceBucketA"),
    b: t("priceBucketB"),
    c: t("priceBucketC"),
  };

  const sizePool: CatalogSizeOption[] = !activeOptions
    ? []
    : query.cat === "shirts"
      ? activeOptions.shirtSizes
      : query.cat === "paintings"
        ? activeOptions.paintingSizes
        : dedupeSizes([...activeOptions.shirtSizes, ...activeOptions.paintingSizes]);

  const filterCount =
    (query.size ? 1 : 0) + (query.color ? 1 : 0) + (query.price ? 1 : 0) + (query.stock ? 1 : 0);

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <div className={styles.cats}>
          {CATS.map((cat) => (
            <Chip key={cat} active={query.cat === cat} onClick={() => pickCat(cat)}>
              {catLabels[cat]}
            </Chip>
          ))}
        </div>

        <div className={styles.spacer} />

        <div className={styles.searchWrap}>
          <label htmlFor="shop-search" className={styles.srOnly}>
            {t("searchLabel")}
          </label>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={styles.searchIcon}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4-4" />
          </svg>
          <input
            id="shop-search"
            type="search"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("search")}
            className={styles.searchInput}
          />
        </div>

        <label htmlFor="shop-sort" className={styles.srOnly}>
          {t("sortLabel")}
        </label>
        <select
          id="shop-sort"
          value={query.sort}
          onChange={(e) => navigate({ sort: e.target.value as ParsedShopQuery["sort"], page: 1 })}
          className={styles.sortSelect}
        >
          <option value="featured">{t("sortFeat")}</option>
          <option value="new">{t("sortNew")}</option>
          <option value="priceAsc">{t("sortAsc")}</option>
          <option value="priceDesc">{t("sortDesc")}</option>
        </select>

        <button
          type="button"
          className={cx(styles.filtersToggle, (filtersOpen || filterCount > 0) && styles.filtersToggleActive)}
          aria-pressed={filtersOpen}
          aria-expanded={filtersOpen}
          aria-controls="shop-filters-panel"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          {t("filters")}
          {filterCount > 0 && <span className={styles.filterCount}>{filterCount}</span>}
        </button>
      </div>

      {filtersOpen && (
        <div id="shop-filters-panel" className={styles.panel}>
          {sizePool.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>{t("fSize")}</div>
              <div className={styles.chipRow}>
                {sizePool.map((s) => (
                  <Chip
                    key={s.code}
                    active={query.size === s.code}
                    onClick={() => navigate({ size: query.size === s.code ? "" : s.code, page: 1 })}
                    className={styles.sizeChip}
                  >
                    {s.code}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {activeOptions && activeOptions.colors.length > 0 && (
            <div className={styles.group}>
              <div className={styles.groupLabel}>{t("fColor")}</div>
              <div className={styles.chipRow}>
                {activeOptions.colors.map((c) => {
                  const active = query.color === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      aria-pressed={active}
                      title={pickText(c.name, locale)}
                      onClick={() => navigate({ color: active ? "" : c.code, page: 1 })}
                      className={cx(styles.swatch, active && styles.swatchActive)}
                      style={{ background: c.hex }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.group}>
            <div className={styles.groupLabel}>{t("fPrice")}</div>
            <div className={styles.chipRow}>
              {BUCKETS.map((bucket) => (
                <Chip
                  key={bucket}
                  active={query.price === bucket}
                  onClick={() => navigate({ price: query.price === bucket ? "" : bucket, page: 1 })}
                >
                  {bucketLabels[bucket]}
                </Chip>
              ))}
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.groupLabel}>{t("fAvail")}</div>
            <Chip active={query.stock} onClick={() => navigate({ stock: !query.stock, page: 1 })}>
              {t("availOnly")}
            </Chip>
          </div>

          <div className={styles.resetWrap}>
            <button
              type="button"
              className={styles.resetLink}
              onClick={() => navigate({ size: "", color: "", price: "", stock: false, page: 1 })}
            >
              {t("reset")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
