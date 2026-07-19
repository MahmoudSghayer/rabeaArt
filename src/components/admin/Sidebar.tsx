"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { SupportedLocale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { LogoutButton } from "./LogoutButton";
import styles from "./Sidebar.module.css";

type NavId =
  | "overview"
  | "orders"
  | "customers"
  | "products"
  | "options"
  | "files"
  | "reports"
  | "settings"
  | "users";

const NAV_ITEMS: { id: NavId; href: string; icon: string }[] = [
  { id: "overview", href: "/admin", icon: "◫" },
  { id: "orders", href: "/admin/orders", icon: "▤" },
  { id: "customers", href: "/admin/customers", icon: "◉" },
  { id: "products", href: "/admin/products", icon: "❖" },
  { id: "options", href: "/admin/options", icon: "⚙" },
  { id: "files", href: "/admin/files", icon: "🗂" },
  { id: "reports", href: "/admin/reports", icon: "▦" },
  { id: "settings", href: "/admin/settings", icon: "✦" },
  { id: "users", href: "/admin/users", icon: "▣" },
];

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
  orderNewCount: number;
  locale: SupportedLocale;
}

/** `/admin/orders/[id]` (and any future nested order route) must still highlight the "Orders"
 * nav entry — every other item matches on exact path or a `/admin/<id>/` prefix. */
function isActive(pathname: string, item: (typeof NAV_ITEMS)[number]): boolean {
  if (item.id === "overview") return pathname === "/admin";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Sidebar({ open, onClose, orderNewCount, locale }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("adminNav");
  const tHeader = useTranslations("header");
  const storeHref = locale === "en" ? "/en" : "/";

  return (
    <>
      {open && (
        <div className={styles.overlay} onClick={onClose} aria-hidden="true" data-noprint="1" />
      )}
      <aside id="admin-sidebar" data-noprint="1" className={cx(styles.aside, open && styles.asideOpen)}>
        <div className={styles.brand}>
          <span className={styles.brandAr}>
            ربيع<span className={styles.brandDot}>.</span>
          </span>
          <span className={styles.brandTag}>ADMIN</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={tHeader("menuCloseLabel")}>
            ×
          </button>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cx(styles.navItem, active && styles.navItemActive)}
                aria-current={active ? "page" : undefined}
              >
                <span className={styles.navIcon} aria-hidden="true">
                  {item.icon}
                </span>
                <span className={styles.navLabel}>{t(item.id)}</span>
                {item.id === "orders" && orderNewCount > 0 && (
                  <span className={styles.navBadge}>{orderNewCount}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className={styles.footer}>
          <a href={storeHref} className={styles.footerLink} target="_blank" rel="noreferrer">
            <span className={styles.footerIcon} aria-hidden="true">
              ↗
            </span>
            {t("viewStore")}
          </a>
          <LogoutButton className={styles.footerLink} icon={styles.footerIcon} />
        </div>
      </aside>
    </>
  );
}
