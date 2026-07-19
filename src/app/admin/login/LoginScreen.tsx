"use client";

import { useTranslations } from "next-intl";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export interface LoginScreenProps {
  next: string;
  storeHref: string;
}

export function LoginScreen({ next, storeHref }: LoginScreenProps) {
  const t = useTranslations("adminLogin");

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoAr}>
            ربيع<span className={styles.logoDot}>.</span>
          </span>
          <span className={styles.logoTag}>RABEA.ART</span>
        </div>
        <div className={styles.subtitle}>{t("subtitle")}</div>
        <LoginForm next={next} />
        <div className={styles.backLink}>
          <a href={storeHref}>{t("backToStore")}</a>
        </div>
      </div>
    </div>
  );
}
