"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { saveSettingsAction } from "./actions";
import { settingsFormSchema, type SettingsFormValues } from "./schema";
import styles from "./settings.module.css";

export interface SettingsFormProps {
  initial: SettingsFormValues;
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const t = useTranslations("adminSettings");
  const tCommon = useTranslations("adminCommon");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({ resolver: zodResolver(settingsFormSchema), defaultValues: initial });

  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: SettingsFormValues) {
    setSaved(false);
    setServerError(null);
    const result = await saveSettingsAction(values);
    if (!result.ok) {
      setServerError(tCommon("errorGeneric"));
      return;
    }
    setSaved(true);
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={styles.cardTitle}>{t("contactSettings")}</div>
      <div className={styles.fieldCol}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("whatsapp")}</span>
          <input dir="ltr" className={styles.input} {...register("whatsapp")} />
          {errors.whatsapp && <span className={styles.errorText}>{t("fieldInvalid")}</span>}
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("email")}</span>
          <input dir="ltr" className={styles.input} {...register("email")} />
          {errors.email && <span className={styles.errorText}>{t("fieldInvalid")}</span>}
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("instagram")}</span>
          <input dir="ltr" className={styles.input} {...register("instagram")} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("announcementAr")}</span>
          <textarea dir="rtl" rows={2} className={styles.textarea} {...register("announcementAr")} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("announcementEn")}</span>
          <textarea dir="ltr" rows={2} className={styles.textarea} {...register("announcementEn")} />
        </label>
        <label className={styles.checkboxRow}>
          <input type="checkbox" {...register("announcementActive")} />
          {t("announcementActive")}
        </label>
        <label className={styles.checkboxRow}>
          <input type="checkbox" {...register("customOtherEnabled")} />
          {t("customOtherEnabled")}
        </label>
      </div>
      <div className={styles.saveRow}>
        <button type="submit" className={styles.saveBtn} disabled={isSubmitting}>
          {isSubmitting ? tCommon("saving") : t("saveSettings")}
        </button>
        {saved && <span className={styles.savedText}>✓ {tCommon("saved")}</span>}
        {serverError && <span className={styles.errorText}>{serverError}</span>}
      </div>
    </form>
  );
}
