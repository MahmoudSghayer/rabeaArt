import { LogoutButton } from "@/components/admin/LogoutButton";
import styles from "../../error-shell.module.css";

/**
 * Dead end for a VALID session that does not resolve to a usable AdminUser row — no row at all,
 * an inactive one, or a role below what the page needs.
 *
 * This page deliberately does NOT call requireAdminPage(). It is the target requireAdminPage
 * redirects a 403 to, so guarding it would recreate the exact infinite loop it exists to break
 * (see src/app/admin/_lib/require.ts).
 *
 * It is safe to leave ungated: it renders no data, only a static explanation and a logout
 * button, and reaching it already required a valid Supabase session.
 *
 * Copy is deliberately specific rather than a generic "access denied". The most common cause is
 * a broken link between the two systems that make up an admin identity — a Supabase Auth user
 * and a matching `admin_users` row keyed by the same UID — and the failure is otherwise silent
 * and very hard to diagnose from the outside.
 */
export const metadata = { title: "لا توجد صلاحية · No access" };

export default function AdminNoAccessPage() {
  return (
    <div className={styles.wrap} dir="rtl" lang="ar">
      <main className={styles.card}>
        <h1 className={styles.title}>حسابك غير مرتبط بصلاحية إدارية</h1>
        <p className={styles.body}>
          تم تسجيل دخولك بنجاح، لكن لا يوجد حساب إداري مرتبط بهذا المستخدم — أو أن الحساب موقوف،
          أو صلاحيته لا تكفي لعرض هذه الصفحة. تواصل مع مالك المتجر لتفعيل حسابك.
        </p>
        <p className={styles.body} dir="ltr" lang="en">
          You are signed in, but this account has no matching admin profile — or it is deactivated,
          or its role is too low for that page. Ask the store owner to enable it.
        </p>
        <div className={styles.actions}>
          <LogoutButton />
        </div>
        {/* The linkage is the usual culprit: admin_users.id must equal the Supabase Auth UID. */}
        <p className={styles.digest}>admin_users.id must match the Supabase Auth user id</p>
      </main>
    </div>
  );
}
