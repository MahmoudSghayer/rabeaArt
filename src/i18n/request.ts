import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  // Base messages + flow messages (custom wizard / order flow) live in separate files so the
  // teams owning each never edit the same JSON. Their top-level namespaces don't overlap
  // (base: brand/nav/common/…; flow: custom/order), so a shallow spread is a real merge —
  // flow files add namespaces, they never replace base ones.
  const base = (await import(`../messages/${locale}.json`)).default;
  const flow = (await import(`../messages/flow-${locale}.json`)).default;

  return {
    locale,
    messages: { ...base, ...flow },
  };
});
