"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/Button";
import styles from "./login.module.css";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

type LoginValues = z.infer<typeof loginSchema>;

export interface LoginFormProps {
  /** Pre-validated internal path to send the admin to after a successful sign-in (see
   * page.tsx — never trusts an arbitrary `?next=` value beyond that check). */
  next: string;
}

/**
 * Supabase applies its own auth rate limiting server-side (see Supabase Auth docs on
 * password-grant rate limits) — this form intentionally does not add a client-side limiter on
 * top of it.
 */
export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const t = useTranslations("adminLogin");
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setAuthError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      // Never echo the Supabase error message — it can distinguish "no such user" from "wrong
      // password", which is an account-enumeration leak. Always show the same generic copy.
      setAuthError(t("invalidCredentials"));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>{t("emailLabel")}</span>
        <input
          {...register("email")}
          type="email"
          dir="ltr"
          placeholder="rabea@rabea.art"
          autoComplete="email"
          className={styles.input}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>{t("passwordLabel")}</span>
        <input
          {...register("password")}
          type="password"
          dir="ltr"
          placeholder={t("passwordPlaceholder")}
          autoComplete="current-password"
          className={styles.input}
        />
      </label>
      {(authError || errors.email || errors.password) && (
        <div className={styles.error}>{authError ?? t("invalidCredentials")}</div>
      )}
      <Button type="submit" fullWidth disabled={isSubmitting}>
        {isSubmitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
