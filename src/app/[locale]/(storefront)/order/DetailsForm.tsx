"use client";

import { useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getCartSnapshotForSubmit, type CartItem } from "@/lib/cart/store";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { cx } from "@/lib/cx";
import type { SubmittedOrder } from "./order-utils";
import styles from "./OrderFlow.module.css";

/** Matches `contactStringSchema` in @/lib/orders/schemas. */
const PHONE_RE = /^[\d+\-\s()]{8,}$/;

type ServerErrorKey =
  | "validation"
  | "rateLimited"
  | "server"
  | "productNotFound"
  | "invalidOption"
  | "customOtherDisabled";

const CONTACT_OPTIONS = ["whatsapp", "phone", "email"] as const;

/** Client-side twin of `customerSchema` (+ consents/notes) with localized messages. The API
 * route re-validates authoritatively with the shared schema; this only drives inline errors. */
function makeSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(2, t("requiredError")).max(200),
    phone: z.string().trim().regex(PHONE_RE, t("phoneError")).max(32, t("phoneError")),
    whatsapp: z
      .string()
      .trim()
      .max(32, t("phoneError"))
      .refine((v) => v === "" || PHONE_RE.test(v), t("phoneError")),
    email: z.email(t("emailError")),
    country: z.string().trim().min(1, t("requiredError")).max(100),
    city: z.string().trim().min(1, t("requiredError")).max(100),
    street: z.string().trim().min(1, t("requiredError")).max(300),
    building: z.string().trim().max(200),
    apt: z.string().trim().max(200),
    postal: z.string().trim().max(20),
    instructions: z.string().trim().max(1000),
    contact: z.enum(CONTACT_OPTIONS),
    notes: z.string().trim().max(2000),
    consentTerms: z.boolean().refine((v) => v, t("agreeTermsError")),
    consentCustomApproval: z.boolean().refine((v) => v, t("agreeCustomError")),
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

type TextFieldName =
  | "name"
  | "phone"
  | "whatsapp"
  | "email"
  | "country"
  | "city"
  | "street"
  | "building"
  | "apt"
  | "postal"
  | "instructions";

type FieldDef = {
  name: TextFieldName;
  labelKey: string;
  phKey?: string;
  required?: boolean;
  span2?: boolean;
  /** Force LTR entry (phones, email, postal code). */
  ltr?: boolean;
  mode?: "tel" | "email" | "numeric";
};

const FIELD_DEFS: FieldDef[] = [
  { name: "name", labelKey: "nameLabel", phKey: "namePh", required: true, span2: true },
  { name: "phone", labelKey: "phoneLabel", phKey: "phonePh", required: true, ltr: true, mode: "tel" },
  { name: "whatsapp", labelKey: "whatsappLabel", phKey: "whatsappPh", ltr: true, mode: "tel" },
  { name: "email", labelKey: "emailLabel", phKey: "emailPh", required: true, ltr: true, mode: "email" },
  { name: "country", labelKey: "countryLabel", phKey: "countryPh", required: true },
  { name: "city", labelKey: "cityLabel", phKey: "cityPh", required: true },
  { name: "street", labelKey: "streetLabel", phKey: "streetPh", required: true, span2: true },
  { name: "building", labelKey: "buildingLabel" },
  { name: "apt", labelKey: "aptLabel" },
  { name: "postal", labelKey: "postalLabel", ltr: true, mode: "numeric" },
  { name: "instructions", labelKey: "instructionsLabel", phKey: "instructionsPh", span2: true },
];

export function DetailsForm({
  items,
  onBack,
  onSubmitted,
}: {
  items: CartItem[];
  onBack: () => void;
  onSubmitted: (order: SubmittedOrder) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("order.form");
  const tErrors = useTranslations("order.errors");
  const tActions = useTranslations("actions");
  const tNav = useTranslations("nav");

  const schema = useMemo(() => makeSchema((key) => t(key as never)), [t]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      whatsapp: "",
      email: "",
      country: "",
      city: "",
      street: "",
      building: "",
      apt: "",
      postal: "",
      instructions: "",
      contact: "whatsapp",
      notes: "",
      consentTerms: false,
      consentCustomApproval: false,
    },
  });

  const contact = useWatch({ control, name: "contact" });
  const consentTerms = useWatch({ control, name: "consentTerms" });
  const consentCustomApproval = useWatch({ control, name: "consentCustomApproval" });

  const [serverError, setServerError] = useState<ServerErrorKey | null>(null);
  const [clientInvalid, setClientInvalid] = useState(false);

  // One idempotency key per checkout attempt-session: generated lazily on the first submit,
  // reused across retries (so a network blip + resubmit can't create two orders), and cleared
  // only after a SUCCESSFUL submit.
  const idempotencyKeyRef = useRef<string | null>(null);

  const onValid = async (values: FormValues) => {
    setClientInvalid(false);
    setServerError(null);
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();

    const payload = {
      idempotencyKey: idempotencyKeyRef.current,
      locale: locale === "en" ? "en" : "ar",
      items: getCartSnapshotForSubmit(items),
      customer: {
        name: values.name,
        phone: values.phone,
        // "WhatsApp (if different)" — empty means "same as phone" (design contract).
        whatsapp: values.whatsapp || values.phone,
        email: values.email,
        country: values.country,
        city: values.city,
        street: values.street,
        building: values.building || undefined,
        apt: values.apt || undefined,
        postal: values.postal || undefined,
        instructions: values.instructions || undefined,
        contact: values.contact,
      },
      notes: values.notes || undefined,
      consentTerms: true,
      consentCustomApproval: true,
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = (await res.json()) as { ref: string; estTotal: number | null; manualCount: number };
        idempotencyKeyRef.current = null;
        onSubmitted({
          ref: data.ref,
          estTotal: data.estTotal,
          manualCount: data.manualCount,
          items,
          customerName: values.name,
          contact: values.contact,
        });
        return;
      }

      if (res.status === 400) {
        setServerError("validation");
      } else if (res.status === 429) {
        setServerError("rateLimited");
      } else if (res.status === 422) {
        const body = (await res.json().catch(() => null)) as { code?: string } | null;
        setServerError(
          body?.code === "PRODUCT_NOT_FOUND"
            ? "productNotFound"
            : body?.code === "CUSTOM_OTHER_DISABLED"
              ? "customOtherDisabled"
              : "invalidOption",
        );
      } else {
        setServerError("server");
      }
    } catch {
      setServerError("server");
    }
  };

  const banner = clientInvalid ? t("errorBanner") : serverError ? tErrors(serverError) : null;

  return (
    <div className={styles.formWrap}>
      <h1 className={styles.pageTitle}>{t("title")}</h1>
      <p className={styles.formSub}>{t("sub")}</p>

      <form
        className={styles.formCard}
        noValidate
        onSubmit={(e) => void handleSubmit(onValid, () => setClientInvalid(true))(e)}
      >
        <div className={styles.fieldsGrid}>
          {FIELD_DEFS.map((f) => (
            <label key={f.name} className={cx(styles.field, f.span2 && styles.span2)}>
              <span className={styles.fieldLabel}>
                {t(f.labelKey as never)} {f.required && <span className={styles.reqMark}>*</span>}
              </span>
              <input
                {...register(f.name)}
                placeholder={f.phKey ? t(f.phKey as never) : undefined}
                inputMode={f.mode}
                autoComplete={
                  f.name === "name"
                    ? "name"
                    : f.name === "phone" || f.name === "whatsapp"
                      ? "tel"
                      : f.name === "email"
                        ? "email"
                        : f.name === "postal"
                          ? "postal-code"
                          : undefined
                }
                className={cx(styles.input, f.ltr && styles.inputLtr, errors[f.name] && styles.inputError)}
              />
              {errors[f.name]?.message && (
                <span className={styles.fieldErr}>{errors[f.name]?.message}</span>
              )}
            </label>
          ))}
        </div>

        <div className={styles.contactBlock}>
          <div className={styles.fieldLabel}>
            {t("contactMethod")} <span className={styles.reqMark}>*</span>
          </div>
          <div className={styles.contactRow}>
            {CONTACT_OPTIONS.map((c) => (
              <Chip key={c} active={contact === c} onClick={() => setValue("contact", c, { shouldDirty: true })}>
                {c === "phone" ? tActions("call") : c === "whatsapp" ? tActions("whatsapp") : tActions("email")}
              </Chip>
            ))}
          </div>
        </div>

        <label className={cx(styles.field, styles.notesBlock)}>
          <span className={styles.fieldLabel}>{t("orderNotes")}</span>
          <textarea
            {...register("notes")}
            rows={3}
            placeholder={t("orderNotesPh")}
            className={cx(styles.input, styles.textarea)}
          />
        </label>

        <div className={styles.consents}>
          <button
            type="button"
            className={styles.consentBtn}
            onClick={() =>
              setValue("consentTerms", !consentTerms, { shouldValidate: submitCount > 0 })
            }
          >
            <span className={cx(styles.checkbox, consentTerms && styles.checkboxOn)} aria-hidden="true">
              {consentTerms && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F6F0E3"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className={styles.consentText}>
              {t("consentTermsPre")}
              <Link href="/legal/terms" className={styles.consentLink} onClick={(e) => e.stopPropagation()}>
                {tNav("terms")}
              </Link>
              {t("consentMid")}
              <Link href="/legal/privacy" className={styles.consentLink} onClick={(e) => e.stopPropagation()}>
                {tNav("privacy")}
              </Link>
            </span>
          </button>
          {errors.consentTerms?.message && (
            <span className={styles.consentErr}>{errors.consentTerms.message}</span>
          )}

          <button
            type="button"
            className={styles.consentBtn}
            onClick={() =>
              setValue("consentCustomApproval", !consentCustomApproval, {
                shouldValidate: submitCount > 0,
              })
            }
          >
            <span
              className={cx(styles.checkbox, consentCustomApproval && styles.checkboxOn)}
              aria-hidden="true"
            >
              {consentCustomApproval && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F6F0E3"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className={styles.consentText}>{t("consentCustom")}</span>
          </button>
          {errors.consentCustomApproval?.message && (
            <span className={styles.consentErr}>{errors.consentCustomApproval.message}</span>
          )}
        </div>

        {banner && (
          <div className={styles.errBanner} role="alert">
            {banner}
          </div>
        )}

        <div className={styles.formNavRow}>
          <Button type="button" variant="outline" onClick={onBack}>
            {tActions("back")}
          </Button>
          <div className={styles.navSpacer} />
          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? t("submitting") : tActions("submitOrder")}
          </Button>
        </div>
        <div className={styles.submitHint}>{t("submitHint")}</div>
      </form>
    </div>
  );
}
