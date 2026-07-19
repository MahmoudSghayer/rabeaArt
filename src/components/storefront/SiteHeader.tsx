"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { SupportedLocale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { useCartCount } from "./cart-count";
import styles from "./SiteHeader.module.css";

type NavId = "home" | "shop" | "shirts" | "paintings" | "custom" | "about" | "contact";
type NavHref = string | { pathname: string; query?: Record<string, string> };

export interface SiteHeaderAnnouncement {
  ar?: string | null;
  en?: string | null;
}

export interface SiteHeaderProps {
  /**
   * Announcement bar text per locale. Falls back to `header.announcementDefault` when omitted —
   * real settings-driven announcements land once the Settings model is wired up (see
   * prisma/schema.prisma `Settings`).
   */
  announcement?: SiteHeaderAnnouncement;
}

const NAV_ITEMS: { id: NavId; href: NavHref }[] = [
  { id: "home", href: "/" },
  { id: "shop", href: "/shop" },
  { id: "shirts", href: { pathname: "/shop", query: { cat: "shirts" } } },
  { id: "paintings", href: { pathname: "/shop", query: { cat: "paintings" } } },
  { id: "custom", href: "/custom" },
  { id: "about", href: "/about" },
  { id: "contact", href: "/contact" },
];

export function SiteHeader({ announcement }: SiteHeaderProps) {
  const locale = useLocale() as SupportedLocale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("header");
  const tNav = useTranslations("nav");
  const cartCount = useCartCount();
  const [menuOpen, setMenuOpen] = useState(false);

  const announcementText = announcement?.[locale] ?? t("announcementDefault");

  function isActive(id: NavId): boolean {
    if (id === "home") return pathname === "/";
    if (id === "shop") return pathname === "/shop";
    // "shirts"/"paintings" both point at /shop with a different `cat` query — without reading
    // search params (which would opt this client component into a Suspense boundary), we treat
    // them as non-active and let the plain "Shop" link carry the active state instead.
    if (id === "shirts" || id === "paintings") return false;
    return pathname === `/${id}` || pathname.startsWith(`/${id}/`);
  }

  function toggleLocale() {
    const nextLocale: SupportedLocale = locale === "ar" ? "en" : "ar";
    document.cookie = `rabea_locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    router.replace(pathname, { locale: nextLocale });
  }

  const orderLabel = tNav("order");
  const orderAriaLabel =
    cartCount > 0 ? t("orderAriaLabelWithCount", { count: cartCount }) : orderLabel;

  return (
    <div className={styles.wrap}>
      <p className={styles.announcement}>{announcementText}</p>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoAr}>
              ربيع<span className={styles.logoDot}>.</span>
            </span>
            <span className={styles.logoEn}>RABEA.ART</span>
          </Link>

          <nav className={styles.desktopNav}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cx(styles.navLink, isActive(item.id) && styles.navLinkActive)}
              >
                {tNav(item.id)}
              </Link>
            ))}
          </nav>

          <div className={styles.spacer} />

          <button
            type="button"
            className={styles.langToggle}
            title={t("langToggleTitle")}
            onClick={toggleLocale}
          >
            {locale === "ar" ? t("toggleToEn") : t("toggleToAr")}
          </button>

          <Link href="/order" className={styles.orderPill} aria-label={orderAriaLabel}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span>{orderLabel}</span>
            {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
          </Link>

          <button
            type="button"
            className={styles.menuButton}
            aria-label={menuOpen ? t("menuCloseLabel") : t("menuOpenLabel")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <nav className={styles.mobileNav}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={cx(styles.mobileNavLink, isActive(item.id) && styles.navLinkActive)}
                onClick={() => setMenuOpen(false)}
              >
                {tNav(item.id)}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </div>
  );
}
