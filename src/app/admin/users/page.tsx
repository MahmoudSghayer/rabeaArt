import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";
import { requireRole, AuthError } from "@/lib/auth/requireRole";
import { createTranslator, getAdminLocale, getAdminMessages } from "../_lib/messages";
import { formatDate, formatDateTime } from "@/components/admin/format";
import { avatarColorForId } from "../customers/avatar";
import { UsersView, type AdminUserRow } from "./UsersView";
import pageStyles from "../admin.module.css";
import styles from "./users.module.css";

/** Admin-user management is OWNER-only (see AGENTS.md role matrix). Unlike every other admin
 * page, this does NOT use `requireAdminPage()` (which redirects to `/admin/login` on ANY
 * `AuthError`) — a logged-in STAFF/ADMIN hitting this page is authenticated but under-privileged
 * (a 403, not a 401), and redirecting them to `/admin/login` would just bounce them right back
 * into the authenticated shell, which redirects to `/admin` — not quite a loop back to THIS page,
 * but a confusing dead end for a perfectly legitimate session. So: 401 (no session at all) still
 * redirects to login; 403 (logged in, insufficient role, or deactivated) renders a bilingual
 * "Owner access required" card in place, no redirect. */
export default async function AdminUsersPage() {
  let admin;
  try {
    admin = await requireRole(AdminRole.OWNER);
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/admin/login");
      const locale = await getAdminLocale();
      const t = createTranslator(await getAdminMessages(locale), "adminUsers");
      return (
        <div className={pageStyles.page}>
          <div className={styles.forbidden}>
            <div className={styles.forbiddenTitle}>{t("forbiddenTitle")}</div>
            <div className={styles.forbiddenBody}>{t("forbiddenBody")}</div>
            <Link href="/admin" className={styles.forbiddenBack}>
              {t("forbiddenBack")}
            </Link>
          </div>
        </div>
      );
    }
    throw err;
  }

  const locale = await getAdminLocale();
  let rows: AdminUserRow[] = [];
  let loadError = false;

  try {
    const users = await prisma.adminUser.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      take: 500,
    });
    rows = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      lastLoginAt: u.lastLoginAt ? formatDateTime(u.lastLoginAt, locale) : null,
      createdAt: formatDate(u.createdAt, locale),
      avatarColor: avatarColorForId(u.id),
    }));
  } catch (err) {
    console.error("AdminUsersPage: failed to load admin users", err);
    loadError = true;
  }

  const loadErrorText = loadError
    ? createTranslator(await getAdminMessages(locale), "adminCommon")("errorGeneric")
    : null;

  return (
    <div className={pageStyles.page}>
      {loadErrorText ? (
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 20 }}>{loadErrorText}</div>
      ) : (
        <UsersView users={rows} currentAdminId={admin.id} />
      )}
    </div>
  );
}
