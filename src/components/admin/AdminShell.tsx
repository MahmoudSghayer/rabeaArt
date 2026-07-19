"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { SupportedLocale } from "@/i18n/routing";
import { Sidebar } from "./Sidebar";
import { HeaderBar } from "./HeaderBar";
import styles from "./AdminShell.module.css";

export interface AdminShellProps {
  orderNewCount: number;
  adminInitial: string;
  locale: SupportedLocale;
  children: ReactNode;
}

/**
 * Persistent sidebar + header shell for every authenticated admin route. Owns the mobile
 * off-canvas drawer's open/closed state (< 980px — see Sidebar.module.css).
 *
 * The login page is rendered by the SAME root layout (admin/layout.tsx handles locale/dir for
 * both), but must never show the sidebar/header chrome of a signed-in session — checking the
 * pathname here (rather than splitting into two layouts/route groups) keeps the login and
 * dashboard pages under one simple layout file.
 */
export function AdminShell({ orderNewCount, adminInitial, locale, children }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className={styles.layout}>
      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        orderNewCount={orderNewCount}
        locale={locale}
      />
      <main className={styles.main}>
        <HeaderBar onMenuOpen={() => setDrawerOpen(true)} adminInitial={adminInitial} drawerOpen={drawerOpen} />
        {children}
      </main>
    </div>
  );
}
