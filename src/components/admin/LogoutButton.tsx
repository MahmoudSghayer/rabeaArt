"use client";

import { useTranslations } from "next-intl";
import { logoutAction } from "@/app/admin/actions";

/**
 * Logging out isn't a `requireRole`-gated business action (see src/app/admin/actions.ts) — any
 * signed-in admin, regardless of role, may end their own session.
 */
export function LogoutButton({ className, icon }: { className?: string; icon?: string }) {
  const t = useTranslations("adminNav");
  return (
    <form action={logoutAction} style={{ display: "block", width: "100%", margin: 0, padding: 0 }}>
      <button type="submit" className={className} style={{ width: "100%" }}>
        <span className={icon} aria-hidden="true">
          ⎋
        </span>
        {t("logout")}
      </button>
    </form>
  );
}
