import Link from "next/link";
import { AdminRole } from "@/generated/prisma/enums";
import { requireAdminPage } from "../_lib/require";
import { createTranslator, getAdminLocale, getAdminMessages } from "../_lib/messages";
import { getSettings } from "@/lib/catalog/queries";
import { SettingsForm } from "./SettingsForm";
import pageStyles from "../admin.module.css";
import styles from "./settings.module.css";

export default async function AdminSettingsPage() {
  await requireAdminPage(AdminRole.ADMIN);
  const locale = await getAdminLocale();
  const messages = await getAdminMessages(locale);
  const t = createTranslator(messages, "adminSettings");

  let settings: Awaited<ReturnType<typeof getSettings>> | null = null;
  try {
    settings = await getSettings();
  } catch (err) {
    console.error("AdminSettingsPage: failed to load settings", err);
  }

  if (!settings) {
    const tCommon = createTranslator(messages, "adminCommon");
    return (
      <div className={pageStyles.page}>
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 40 }}>{tCommon("errorGeneric")}</div>
      </div>
    );
  }

  return (
    <div className={pageStyles.page}>
      <div className={styles.grid}>
        <SettingsForm
          initial={{
            whatsapp: settings.whatsapp,
            email: settings.email,
            instagram: settings.instagram ?? "",
            announcementAr: settings.announcement.ar,
            announcementEn: settings.announcement.en,
            announcementActive: settings.announcementActive,
            customOtherEnabled: settings.customOtherEnabled,
          }}
        />
        <div className={styles.sideCol}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>{t("languages")}</div>
            <div className={styles.cardHint}>{t("languagesHint")}</div>
            <div className={styles.langList}>
              <div className={styles.langRow}>
                <span className={styles.langDot} style={{ background: "#3F7048" }} />
                العربية (RTL) — {t("langDefault")}
              </div>
              <div className={styles.langRow}>
                <span className={styles.langDot} style={{ background: "#3F7048" }} />
                English (LTR)
              </div>
              <div className={styles.langRowSoon}>
                <span className={styles.langDot} style={{ background: "#C9C2B2" }} />
                עברית (RTL) — {t("langSoon")}
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>{t("adminUsers")}</div>
            <div className={styles.cardHint}>{t("adminUsersHint")}</div>
            <Link href="/admin/users" className={styles.usersLink}>
              {t("adminUsersLinkBtn")} {locale === "ar" ? "←" : "→"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
