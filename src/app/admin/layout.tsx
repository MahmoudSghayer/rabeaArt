import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import type { SupportedLocale } from "@/i18n/routing";

/**
 * Admin is not URL-locale-prefixed (see plan: "Admin routes are NOT locale-prefixed"), so it
 * resolves its own locale from the shared `rabea_locale` cookie instead of a [locale] segment,
 * and loads messages directly rather than going through next-intl's route-bound request config.
 * The language-toggle button (M4) sets this same cookie and refreshes.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const locale: SupportedLocale = cookieStore.get("rabea_locale")?.value === "en" ? "en" : "ar";
  const messages = (await import(`@/messages/${locale}.json`)).default;

  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="admin-shell" lang={locale} dir={dir} style={{ minHeight: "100dvh" }}>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
