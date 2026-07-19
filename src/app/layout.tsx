import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Amiri, IBM_Plex_Sans_Arabic, Instrument_Serif } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-ibm-plex-sans-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rabea.art",
  description: "Art you wear, stories you hang — custom shirts, paintings, and prints.",
};

/**
 * The single root layout shared by both the localized storefront ([locale]/**) and the
 * non-localized admin dashboard (admin/**) — Next.js allows only one <html>/<body>.
 * `getLocale()` resolves correctly for storefront routes (from the [locale] segment via
 * proxy.ts's next-intl middleware); for admin routes (outside [locale]) it falls back to
 * routing.defaultLocale ('ar') — admin's own layout additionally sets dir/lang on its inner
 * wrapper to reflect the admin language-toggle cookie. See [locale]/layout.tsx and
 * admin/layout.tsx for each subtree's NextIntlClientProvider.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${amiri.variable} ${ibmPlexSansArabic.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
