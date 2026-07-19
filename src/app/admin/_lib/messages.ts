import "server-only";
import { cookies } from "next/headers";
import type { SupportedLocale } from "@/i18n/routing";

/**
 * Admin's own tiny server-side i18n reader — deliberately NOT `next-intl/server`'s
 * `getTranslations()`. That helper resolves the locale via next-intl's routing-bound
 * `requestLocale` (see src/i18n/request.ts), which is only ever populated by the intl
 * middleware — and admin routes bypass that middleware entirely (see src/proxy.ts,
 * `handleAdminGate`). Using it here would silently always resolve to the default locale and
 * ignore the `rabea_locale` cookie / admin message files.
 *
 * Client components still use the real `useTranslations()` via `NextIntlClientProvider`, which
 * IS locale-correct because admin/layout.tsx passes it an explicit `locale`/`messages` pair (not
 * derived from routing) — this module exists only for Server Components that render translated,
 * read-only text without needing a Client Component just for that.
 */

type MessageTree = { [key: string]: string | MessageTree };

export async function getAdminLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  return cookieStore.get("rabea_locale")?.value === "en" ? "en" : "ar";
}

/** Same deep-merge as admin/layout.tsx: base storefront messages + admin-only messages. */
export async function getAdminMessages(locale: SupportedLocale): Promise<MessageTree> {
  const [base, admin] = await Promise.all([
    import(`@/messages/${locale}.json`).then((m) => m.default as MessageTree),
    import(`@/messages/admin-${locale}.json`).then((m) => m.default as MessageTree),
  ]);
  return { ...base, ...admin };
}

function getPath(messages: MessageTree, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in (acc as MessageTree)) {
      return (acc as MessageTree)[segment];
    }
    return undefined;
  }, messages);
}

/** Minimal `{var}` interpolation — enough for the handful of parameterized admin strings
 * (e.g. "adminOrders.itemsMore": "+{count}"); not a full ICU MessageFormat implementation. */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

/** Returns a `t(key, vars?)` function scoped to `namespace`. Falls back to `"namespace.key"`
 * (not a thrown error) when a key is missing, so a translation gap degrades visibly instead of
 * breaking the page. */
export function createTranslator(messages: MessageTree, namespace: string) {
  return function t(key: string, vars?: Record<string, string | number>): string {
    const value = getPath(messages, `${namespace}.${key}`);
    if (typeof value !== "string") return `${namespace}.${key}`;
    return interpolate(value, vars);
  };
}
