import { defineRouting } from "next-intl/routing";

/**
 * Hebrew exists as a message-file skeleton (src/messages/he.json) but is intentionally left
 * out of SUPPORTED_LOCALES until content is translated — "Hebrew-ready architecture" without
 * exposing an unfinished locale. Arabic is the default (no URL prefix); English is prefixed.
 */
export const SUPPORTED_LOCALES = ["ar", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * The storefront is Arabic-first: the language switcher is hidden and every visitor lands on
 * Arabic regardless of browser language. English is fully built and still reachable at /en
 * (useful for sharing a link with a non-Arabic speaker) — flip this to `true` and the switcher
 * returns everywhere, no other change needed.
 */
export const SHOW_LANGUAGE_SWITCHER = false;

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: "ar",
  localePrefix: "as-needed",
  localeCookie: {
    name: "rabea_locale",
  },
  // Arabic-first by intent: without this, next-intl reads Accept-Language and sends anyone
  // with an English or Hebrew device straight to /en. Most of the studio's customers browse
  // on non-Arabic devices, so detection actively works against the brand's default.
  localeDetection: false,
});
