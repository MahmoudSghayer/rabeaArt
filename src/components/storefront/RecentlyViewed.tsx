"use client";

import { useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { SupportedLocale } from "@/i18n/routing";
import { grainedArt } from "@/components/storefront/art";
import { resolveArtKey } from "@/components/storefront/product-art";
import { Ornament } from "@/components/decor";
import styles from "./RecentlyViewed.module.css";

const STORAGE_KEY = "rabea_recent";
const MAX_ITEMS = 6;
const EMPTY_RECENT: RecentProduct[] = [];

/**
 * Shape stored in localStorage (`rabea_recent`) and consumed here — most-recent-first, capped
 * at `MAX_ITEMS`. No price/stock is kept: those go stale, and this list is a lightweight
 * "jump back in" trail, not a live product snapshot.
 */
export interface RecentProduct {
  slug: string;
  nameAr: string;
  nameEn: string;
  /** Should come from `artKeyForSlug` in `@/components/storefront/product-art`. */
  artKey: string;
}

function isRecentProduct(value: unknown): value is RecentProduct {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === "string" &&
    typeof v.nameAr === "string" &&
    typeof v.nameEn === "string" &&
    typeof v.artKey === "string"
  );
}

function parseRecent(raw: string | null): RecentProduct[] {
  if (!raw) return EMPTY_RECENT;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_RECENT;
    const items = parsed.filter(isRecentProduct).slice(0, MAX_ITEMS);
    return items.length > 0 ? items : EMPTY_RECENT;
  } catch {
    return EMPTY_RECENT;
  }
}

/**
 * Tiny external store wrapping localStorage, read via `useSyncExternalStore`. This is the
 * React-recommended way to read a browser-only API on mount without a hydration mismatch or a
 * "setState inside an effect" cascading render — `getServerSnapshot` returns the stable empty
 * array during SSR, and the real snapshot is cached so repeated reads with unchanged data return
 * the same reference. `notify()` lets `pushRecent` (called from the product detail page) wake
 * any currently-mounted `RecentlyViewed` instance in the same tab.
 */
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedSnapshot: RecentProduct[] = EMPTY_RECENT;

function getSnapshot(): RecentProduct[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = parseRecent(raw);
  return cachedSnapshot;
}

function getServerSnapshot(): RecentProduct[] {
  return EMPTY_RECENT;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function notify(): void {
  cachedRaw = undefined; // force a re-read on the next getSnapshot() call
  listeners.forEach((listener) => listener());
}

/**
 * Records a product as recently viewed. Intended to be called from the product detail page
 * (`/product/[slug]`) once the product has loaded, e.g.:
 *
 *   pushRecent({ slug, nameAr, nameEn, artKey: artKeyForSlug(slug) });
 *
 * Most-recent-first, de-duplicated by slug, capped at 6. Silently no-ops if localStorage is
 * unavailable (private browsing, quota, SSR).
 */
export function pushRecent(item: RecentProduct): void {
  if (typeof window === "undefined") return;
  try {
    const existing = parseRecent(window.localStorage.getItem(STORAGE_KEY)).filter(
      (r) => r.slug !== item.slug,
    );
    const next = [item, ...existing].slice(0, MAX_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notify();
  } catch {
    // Best-effort persistence only — never block the page for this.
  }
}

/** Horizontal "recently viewed" strip for the Shop page. Renders nothing when empty. */
export function RecentlyViewed() {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("shop");
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (items.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.heading}>
        <Ornament name="spool" size={15} strokeWidth={1.5} className={styles.headingMark} />
        {t("recent")}
      </div>
      <div className={styles.strip}>
        {items.map((item) => (
          <Link key={item.slug} href={`/product/${item.slug}`} className={styles.card}>
            <div
              className={styles.art}
              style={{ backgroundImage: grainedArt(resolveArtKey(item.artKey)) }}
              aria-hidden="true"
            />
            <div className={styles.name}>{locale === "ar" ? item.nameAr : item.nameEn}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
