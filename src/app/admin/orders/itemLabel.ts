import type { SupportedLocale } from "@/i18n/routing";

export interface ItemLabelSource {
  snapshotNameAr: string | null;
  snapshotNameEn: string | null;
  labelAr: string | null;
  labelEn: string | null;
}

/**
 * Best-effort localized display name for an OrderItem. Catalog items (SHIRT/PAINTING) carry a
 * `snapshotName*` (the product name at order time — see src/lib/orders/submit.ts); custom items
 * (CUSTOM_*) carry a `label*` instead. Falls back to the other locale if the preferred one is
 * empty, so an item never renders as a blank string — used by the orders list, order detail, and
 * both CSV export routes, which must all agree on what an item is "called".
 */
export function pickItemLabel(item: ItemLabelSource, locale: SupportedLocale): string {
  const ar = item.snapshotNameAr ?? item.labelAr;
  const en = item.snapshotNameEn ?? item.labelEn;
  const primary = locale === "ar" ? ar : en;
  const fallback = locale === "ar" ? en : ar;
  return primary || fallback || "";
}
