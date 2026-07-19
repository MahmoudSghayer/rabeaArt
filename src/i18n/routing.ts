import { defineRouting } from "next-intl/routing";

/**
 * Hebrew exists as a message-file skeleton (src/messages/he.json) but is intentionally left
 * out of SUPPORTED_LOCALES until content is translated — "Hebrew-ready architecture" without
 * exposing an unfinished locale. Arabic is the default (no URL prefix); English is prefixed.
 */
export const SUPPORTED_LOCALES = ["ar", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: "ar",
  localePrefix: "as-needed",
  localeCookie: {
    name: "rabea_locale",
  },
});
