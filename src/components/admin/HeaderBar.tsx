"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageToggle } from "./LanguageToggle";
import styles from "./HeaderBar.module.css";

const SECTION_BY_PREFIX: { prefix: string; id: string }[] = [
  { prefix: "/admin/orders", id: "orders" },
  { prefix: "/admin/customers", id: "customers" },
  { prefix: "/admin/products", id: "products" },
  { prefix: "/admin/options", id: "options" },
  { prefix: "/admin/files", id: "files" },
  { prefix: "/admin/reports", id: "reports" },
  { prefix: "/admin/settings", id: "settings" },
  { prefix: "/admin/users", id: "users" },
];

function sectionIdFor(pathname: string): string {
  const match = SECTION_BY_PREFIX.find((s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`));
  return match?.id ?? "overview";
}

export interface HeaderBarProps {
  onMenuOpen: () => void;
  adminInitial: string;
  drawerOpen: boolean;
}

export function HeaderBar({ onMenuOpen, adminInitial, drawerOpen }: HeaderBarProps) {
  const pathname = usePathname();
  const tNav = useTranslations("adminNav");
  const title = tNav(sectionIdFor(pathname) as never);

  return (
    <header data-noprint="1" className={styles.header}>
      <button
        type="button"
        className={styles.menuBtn}
        onClick={onMenuOpen}
        aria-label={title}
        aria-expanded={drawerOpen}
        aria-controls="admin-sidebar"
      >
        ☰
      </button>
      <div className={styles.title}>{title}</div>
      <div className={styles.spacer} />
      <LanguageToggle />
      <span className={styles.avatar} aria-hidden="true">
        {adminInitial}
      </span>
    </header>
  );
}
