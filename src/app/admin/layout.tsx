import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { requireAdmin, AuthError } from "@/lib/auth/requireRole";
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@/generated/prisma/enums";
import { AdminShell } from "@/components/admin/AdminShell";
import { initialOf } from "@/components/admin/format";
import { getAdminLocale, getAdminMessages } from "./_lib/messages";
import styles from "./admin.module.css";

/**
 * Admin is not URL-locale-prefixed (see plan: "Admin routes are NOT locale-prefixed"), so it
 * resolves its own locale from the shared `rabea_locale` cookie instead of a [locale] segment,
 * and loads messages directly rather than going through next-intl's route-bound request config.
 * The language-toggle button (see components/admin/LanguageToggle.tsx) sets this same cookie via
 * a Server Action and the page re-renders automatically.
 *
 * Admin messages (src/messages/admin-{locale}.json) are deep-merged with the base storefront
 * messages (src/messages/{locale}.json) — the base file is needed for StatusPill's
 * "orderStatus"/"paymentStatus" namespaces and a few reused strings (e.g. "header.*"). A shallow
 * spread is enough because the two files' top-level namespaces never overlap.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const locale = await getAdminLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  const [messages, orderNewCount, adminInitial] = await Promise.all([
    getAdminMessages(locale),
    loadNewOrderCount(),
    loadAdminInitial(),
  ]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className={styles.shellBg} lang={locale} dir={dir}>
        <AdminShell orderNewCount={orderNewCount} adminInitial={adminInitial} locale={locale}>
          {children}
        </AdminShell>
      </div>
    </NextIntlClientProvider>
  );
}

/** Feeds the sidebar's "Orders" nav badge — fails closed to "no badge" rather than breaking the
 * whole admin shell if the DB is briefly unreachable (see project plan on graceful DB failure). */
async function loadNewOrderCount(): Promise<number> {
  try {
    return await prisma.order.count({ where: { status: OrderStatus.NEW } });
  } catch (err) {
    console.error("AdminLayout: failed to load the new-order count", err);
    return 0;
  }
}

/** Header avatar initial. Falls back to the brand glyph when there's no session yet (the login
 * page) or the DB is unreachable — this is decorative chrome, never an auth gate (see
 * requireAdminPage in each protected page for the real gate). */
async function loadAdminInitial(): Promise<string> {
  try {
    const admin = await requireAdmin();
    return initialOf(admin.name || admin.email);
  } catch (err) {
    if (!(err instanceof AuthError)) console.error("AdminLayout: failed to load the admin user", err);
    return "ر";
  }
}
