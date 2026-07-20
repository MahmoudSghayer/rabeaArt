import type { SupportedLocale } from "@/i18n/routing";

export interface ItemLabelSource {
  snapshotNameAr: string | null;
  snapshotNameEn: string | null;
  labelAr: string | null;
  labelEn: string | null;
  /** Live product name — only present when the caller joins `product`. Last-resort fallback for
   * the (should-never-happen) case where both the snapshot and label columns are empty. */
  product?: { nameAr: string; nameEn: string } | null;
}

/**
 * Best-effort localized display name for an OrderItem. Catalog items (SHIRT/PAINTING) carry a
 * `snapshotName*` (the product name at order time — see src/lib/orders/submit.ts); custom items
 * (CUSTOM_*) carry a `label*` instead. Falls back to the other locale if the preferred one is
 * empty, then to the live product name, so an item never renders as a blank string — used by the
 * orders list, order detail, and both CSV export routes, which must all agree on what an item is
 * "called".
 */
export function pickItemLabel(item: ItemLabelSource, locale: SupportedLocale): string {
  const ar = item.snapshotNameAr ?? item.labelAr ?? item.product?.nameAr ?? null;
  const en = item.snapshotNameEn ?? item.labelEn ?? item.product?.nameEn ?? null;
  const primary = locale === "ar" ? ar : en;
  const fallback = locale === "ar" ? en : ar;
  return primary || fallback || "";
}
