/**
 * Small display-formatting helpers shared across the admin UI. Ports the formatting rules from
 * `_design-reference/store.js` (`fmtILS`/`fmtDate`/`fmtDateTime`) to Prisma's plain
 * numbers/Dates — kept here (not in a `lib/`) since these are pure presentation helpers used only
 * by admin components, not business logic.
 */
import type { SupportedLocale } from "@/i18n/routing";

/** `₪1,234` — Latin digits regardless of locale (matches the design's `fmtILS`). Returns `naLabel`
 * for `null` (an item/order that hasn't been priced yet, e.g. custom work before review). */
export function formatMoney(value: number | null, naLabel: string): string {
  if (value === null) return naLabel;
  return `₪${value.toLocaleString("en-US")}`;
}

/** `12 Jul 2026` (en) / equivalent Arabic month names with Latin numerals (ar) — see store.js `fmtDate`. */
export function formatDate(value: Date | string, locale: SupportedLocale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(locale === "ar" ? "ar-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Same as {@link formatDate} plus a 24h time — used in history/notes timestamps. */
export function formatDateTime(value: Date | string, locale: SupportedLocale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString(locale === "ar" ? "ar-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** First character for an avatar circle (e.g. "ر" or "N") — not locale-aware beyond taking the
 * first Unicode code point, which is enough for both Arabic and Latin names. */
export function initialOf(name: string): string {
  return [...name.trim()][0]?.toUpperCase() ?? "?";
}

/** Digits-only phone number for a `wa.me` deep link (no leading `+`). */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** `412 KB` / `1.8 MB` — port of store.js `fmtBytes`, used for order-file attachment chips. */
export function formatBytes(bytes: number): string {
  if (bytes > 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
