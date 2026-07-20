import type { CartItem } from "@/lib/cart/store";
import { pickText, type CatalogLocale, type LocalizedText } from "@/lib/catalog/types";
import { grainedArt } from "@/components/storefront/art";
import { productArtBackground } from "@/components/storefront/product-art";
import type { OptionLabelMaps } from "../custom/fallback-options";

/** Pure display helpers for the /order flow (ported from `optLine`/`itemBg`/`cartTotals` in
 * the design prototype's Order.dc.html + store.js). */

/** What the confirmation step keeps after the cart is cleared — the pre-clear snapshot. */
export type SubmittedOrder = {
  ref: string;
  /** null = every item is manually priced ("set after review"). */
  estTotal: number | null;
  manualCount: number;
  items: CartItem[];
  customerName: string;
  contact: "phone" | "whatsapp" | "email";
};

export function itemName(item: CartItem, locale: CatalogLocale): string {
  const text: LocalizedText =
    item.kind === "shirt" || item.kind === "painting"
      ? { ar: item.nameAr, en: item.nameEn }
      : { ar: item.labelAr, en: item.labelEn };
  return pickText(text, locale);
}

/** CSS background for an item's thumb: first staged-file preview for custom items, the
 * slug-derived art gradient for catalog items, the generic "custom" gradient otherwise. */
export function itemArtBackground(item: CartItem): string {
  if (item.kind === "shirt" || item.kind === "painting") return productArtBackground(item.slug);
  const preview = item.files[0]?.previewDataUrl;
  return preview ? `url(${preview})` : grainedArt("custom");
}

function lookup(map: Record<string, LocalizedText>, code: string, locale: CatalogLocale): string {
  return pickText(map[code], locale) || code;
}

export type SummaryStrings = {
  /** "Size " / "مقاس " prefix. */
  sizePrefix: string;
  /** Shown for a custom painting size with no dims recorded. */
  customDims: string;
};

/**
 * One "option summary" line per cart item — localized labels resolved through the
 * DB-backed (or fallback) label maps, unknown codes degrade to the raw code. Field order
 * matches the design's `optLine`: type · size · color · method · placement · frame ·
 * material · style · orientation.
 */
export function optionSummary(
  item: CartItem,
  labels: OptionLabelMaps,
  locale: CatalogLocale,
  s: SummaryStrings,
): string {
  const parts: string[] = [];

  if (item.kind === "shirt") {
    parts.push(s.sizePrefix + lookup(labels.sizes, item.sizeCode, locale));
    parts.push(lookup(labels.colors, item.colorCode, locale));
    if (item.method) parts.push(lookup(labels.methods, item.method, locale));
    return parts.join(" · ");
  }

  if (item.kind === "painting") {
    parts.push(s.sizePrefix + lookup(labels.sizes, item.sizeCode, locale));
    if (item.frameCode && item.frameCode !== "none") {
      parts.push(lookup(labels.frames, item.frameCode, locale));
    }
    return parts.join(" · ");
  }

  const o = item.options;
  const str = (key: string): string | undefined => {
    const v = o[key];
    return typeof v === "string" && v ? v : undefined;
  };
  const arr = (key: string): string[] | undefined => {
    const v = o[key];
    return Array.isArray(v) && v.length > 0 ? v : undefined;
  };

  const type = str("type");
  if (type) parts.push(lookup(labels.shirtTypes, type, locale));
  const size = str("size");
  if (size) {
    const dims = str("dims");
    parts.push(s.sizePrefix + (size === "custom" ? (dims ?? s.customDims) : lookup(labels.sizes, size, locale)));
  }
  const color = str("color");
  if (color) parts.push(lookup(labels.colors, color, locale));
  const method = str("method");
  if (method) parts.push(lookup(labels.methods, method, locale));
  const placement = arr("placement");
  if (placement) parts.push(placement.map((p) => lookup(labels.placements, p, locale)).join("+"));
  const material = str("material");
  if (material) parts.push(lookup(labels.materials, material, locale));
  const style = str("style");
  if (style) parts.push(lookup(labels.paintStyles, style, locale));
  const orientation = str("orientation");
  if (orientation) parts.push(lookup(labels.orientations, orientation, locale));

  return parts.join(" · ");
}

export type CartTotals = {
  /** Sum of qty across items. */
  count: number;
  /** Sum of unitPrice×qty over PRICED items — display-only; the server reprices at submit. */
  est: number;
  /** Number of manually-priced (null-price) ITEMS. */
  manual: number;
};

export function computeCartTotals(items: CartItem[]): CartTotals {
  let count = 0;
  let est = 0;
  let manual = 0;
  for (const item of items) {
    count += item.qty;
    if (item.unitPrice == null) manual += 1;
    else est += item.unitPrice * item.qty;
  }
  return { count, est, manual };
}

/** wa.me deep link for an arbitrary number (the settings-driven studio number — the fixed
 * helper in @/components/storefront/contact-info only knows the hardcoded fallback). */
export function waHrefFor(number: string, text?: string): string {
  const base = `https://wa.me/${number.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function mailtoFor(email: string, subject?: string): string {
  const base = `mailto:${email}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}
