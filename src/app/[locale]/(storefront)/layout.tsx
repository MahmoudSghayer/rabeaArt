import type { ReactNode } from "react";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { SiteFooter } from "@/components/storefront/SiteFooter";

/**
 * Shared storefront shell: sticky SiteHeader (nav, language toggle, cart badge) + page content
 * + SiteFooter. `SiteHeader`'s `announcement` prop is left unset here so it falls back to the
 * `header.announcementDefault` message — real settings-driven announcements land once the
 * Settings model is wired up (see prisma/schema.prisma `Settings`).
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="storefront-shell">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
