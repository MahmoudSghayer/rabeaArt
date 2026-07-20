"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { ProductType } from "@/generated/prisma/enums";
import type { SupportedLocale } from "@/i18n/routing";
import { cx } from "@/lib/cx";
import { saveProductAction } from "@/app/admin/products/actions";
import { productFormSchema, type ProductFormValues } from "./schema";
import type { CategoryOption, ColorOption, ProductFormInitialData, SizeOption } from "./types";
import { VariantMatrix } from "./VariantMatrix";
import { ImagesField } from "./ImagesField";
import styles from "./ProductForm.module.css";

export interface ProductFormProps {
  initial: ProductFormInitialData;
  categories: CategoryOption[];
  colors: ColorOption[];
  shirtSizes: SizeOption[];
  /** PAINTING-scope sizes excluding "custom" — custom sizing is always manually priced. */
  paintingSizes: SizeOption[];
}

function toDefaultValues(initial: ProductFormInitialData): ProductFormValues {
  return {
    id: initial.id ?? undefined,
    type: initial.type,
    nameAr: initial.nameAr,
    nameEn: initial.nameEn,
    descAr: initial.descAr,
    descEn: initial.descEn,
    slug: initial.slug,
    categoryId: initial.categoryId,
    featured: initial.featured,
    prepAr: initial.prepAr,
    prepEn: initial.prepEn,
    displayOrder: initial.displayOrder,
    price: initial.price,
    sale: initial.sale,
    printAvailable: initial.printAvailable,
    embroideryAvailable: initial.embroideryAvailable,
    trackStock: initial.trackStock,
    colorCodes: initial.colorCodes,
    sizeCodes: initial.sizeCodes,
    variantStocks: initial.variantStocks,
    isOriginal: initial.isOriginal,
    artistNoteAr: initial.artistNoteAr,
    artistNoteEn: initial.artistNoteEn,
    sizePrices: initial.sizePrices,
    images: initial.images.map((img) => ({ path: img.path, alt: img.alt, isPrimary: img.isPrimary, sortOrder: img.sortOrder })),
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

export function ProductForm({ initial, categories, colors, shirtSizes, paintingSizes }: ProductFormProps) {
  const router = useRouter();
  const t = useTranslations("adminProductForm");
  const tCommon = useTranslations("adminCommon");
  const locale = useLocale() as SupportedLocale;
  const isCreate = !initial.id;

  const methods = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: toDefaultValues(initial),
  });
  const { register, handleSubmit, watch, getValues, setValue, setError, formState } = methods;
  const { errors, isSubmitting } = formState;

  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const slugTouchedRef = useRef(Boolean(initial.slug) && !isCreate);
  const draftIdRef = useRef(initial.id ?? crypto.randomUUID());

  const type = watch("type");
  const colorCodesRaw = watch("colorCodes");
  const colorCodes = useMemo(() => colorCodesRaw ?? [], [colorCodesRaw]);
  const sizeCodesRaw = watch("sizeCodes");
  const sizeCodes = useMemo(() => sizeCodesRaw ?? [], [sizeCodesRaw]);
  const trackStock = watch("trackStock");
  const featured = watch("featured");
  const printAvailable = watch("printAvailable");
  const embroideryAvailable = watch("embroideryAvailable");
  const isOriginal = watch("isOriginal");

  const availableCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  // Active-or-already-selected: a colour/size since deactivated on the Options page must stay
  // visible (and toggleable off) on a product that already used it, but shouldn't be offered as
  // a fresh pick on any other product.
  const visibleColors = useMemo(() => colors.filter((c) => c.active || colorCodes.includes(c.code)), [colors, colorCodes]);
  const visibleShirtSizes = useMemo(
    () => shirtSizes.filter((s) => s.active || sizeCodes.includes(s.code)),
    [shirtSizes, sizeCodes],
  );

  function syncVariantMatrix(nextColors: string[], nextSizes: string[]) {
    const existing = getValues("variantStocks") ?? [];
    const byCombo = new Map(existing.map((v) => [`${v.colorCode}:${v.sizeCode}`, v.stock]));
    const combos: ProductFormValues["variantStocks"] = [];
    for (const c of nextColors) {
      for (const s of nextSizes) {
        combos.push({ colorCode: c, sizeCode: s, stock: byCombo.get(`${c}:${s}`) ?? "0" });
      }
    }
    setValue("variantStocks", combos, { shouldDirty: true });
  }

  function toggleColor(code: string) {
    const next = colorCodes.includes(code) ? colorCodes.filter((c) => c !== code) : [...colorCodes, code];
    setValue("colorCodes", next, { shouldDirty: true });
    syncVariantMatrix(next, sizeCodes);
  }

  function toggleSize(code: string) {
    const next = sizeCodes.includes(code) ? sizeCodes.filter((c) => c !== code) : [...sizeCodes, code];
    setValue("sizeCodes", next, { shouldDirty: true });
    syncVariantMatrix(colorCodes, next);
  }

  function onTypeClick(next: ProductType) {
    if (!isCreate) return; // locked after creation
    setValue("type", next, { shouldDirty: true });
    const stillValid = categories.some((c) => c.type === next && c.id === getValues("categoryId"));
    if (!stillValid) {
      const first = categories.find((c) => c.type === next);
      if (first) setValue("categoryId", first.id);
    }
  }

  function onNameEnChange(value: string) {
    setValue("nameEn", value);
    if (isCreate && !slugTouchedRef.current) {
      setValue("slug", slugify(value));
    }
  }

  function onSlugChange(value: string) {
    slugTouchedRef.current = true;
    setValue("slug", value);
  }

  async function onSubmit(values: ProductFormValues) {
    setSaved(false);
    setServerError(null);
    const payload: ProductFormValues = {
      ...values,
      images: values.images.map((img, idx) => ({ ...img, sortOrder: idx })),
    };
    const result = await saveProductAction(payload);
    if (!result.ok) {
      if (result.error === "SLUG_TAKEN") {
        setError("slug", { message: t("slugTaken") });
      } else {
        setServerError(tCommon("errorGeneric"));
      }
      return;
    }
    setSaved(true);
    if (isCreate && result.id) {
      router.replace(`/admin/products/${result.id}/edit`);
    } else {
      router.refresh();
    }
  }

  return (
    <FormProvider {...methods}>
      <form className={styles.formCard} onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className={styles.formTitle}>{isCreate ? t("titleNew") : t("titleEdit")}</div>

        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("nameAr")}</span>
            <input dir="rtl" className={styles.input} {...register("nameAr")} />
            {errors.nameAr && <span className={styles.errorText}>{t("fieldInvalid")}</span>}
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("nameEn")}</span>
            <input
              dir="ltr"
              className={styles.input}
              value={watch("nameEn")}
              onChange={(e) => onNameEnChange(e.target.value)}
            />
            {errors.nameEn && <span className={styles.errorText}>{t("fieldInvalid")}</span>}
          </label>

          <label className={cx(styles.field, styles.span2)}>
            <span className={styles.fieldLabel}>{t("descAr")}</span>
            <textarea dir="rtl" rows={3} className={styles.textarea} {...register("descAr")} />
          </label>
          <label className={cx(styles.field, styles.span2)}>
            <span className={styles.fieldLabel}>{t("descEn")}</span>
            <textarea dir="ltr" rows={3} className={styles.textarea} {...register("descEn")} />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("slug")}</span>
            <input
              dir="ltr"
              className={styles.input}
              value={watch("slug")}
              onChange={(e) => onSlugChange(e.target.value)}
            />
            {errors.slug && <span className={styles.errorText}>{errors.slug.message ?? t("fieldInvalid")}</span>}
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("category")}</span>
            <select className={styles.select} {...register("categoryId")}>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {locale === "ar" ? c.nameAr : c.nameEn}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("prepAr")}</span>
            <input dir="rtl" className={styles.input} {...register("prepAr")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("prepEn")}</span>
            <input dir="ltr" className={styles.input} {...register("prepEn")} />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t("displayOrder")}</span>
            <input inputMode="numeric" dir="ltr" className={styles.input} {...register("displayOrder")} />
          </label>
        </div>

        <div className={styles.rowGroup}>
          <div>
            <div className={styles.groupLabel}>{t("type")}</div>
            <div className={styles.pillRow}>
              {([ProductType.SHIRT, ProductType.PAINTING] as const).map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => onTypeClick(pt)}
                  disabled={!isCreate}
                  className={cx(styles.pill, type === pt && styles.pillActive)}
                >
                  {pt === ProductType.SHIRT ? t("typeShirt") : t("typePainting")}
                </button>
              ))}
            </div>
            {!isCreate && <p className={styles.hint}>{t("typeLockedHint")}</p>}
          </div>

          <div>
            <div className={styles.groupLabel}>{t("flags")}</div>
            <div className={styles.pillRow}>
              <button
                type="button"
                onClick={() => setValue("featured", !featured, { shouldDirty: true })}
                className={cx(styles.pill, featured && styles.pillActive)}
              >
                {featured ? "✓ " : ""}
                {t("flagFeatured")}
              </button>
              {type === ProductType.SHIRT && (
                <>
                  <button
                    type="button"
                    onClick={() => setValue("printAvailable", !printAvailable, { shouldDirty: true })}
                    className={cx(styles.pill, printAvailable && styles.pillActive)}
                  >
                    {printAvailable ? "✓ " : ""}
                    {t("flagPrint")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue("embroideryAvailable", !embroideryAvailable, { shouldDirty: true })}
                    className={cx(styles.pill, embroideryAvailable && styles.pillActive)}
                  >
                    {embroideryAvailable ? "✓ " : ""}
                    {t("flagEmbroidery")}
                  </button>
                </>
              )}
              {type === ProductType.PAINTING && (
                <button
                  type="button"
                  onClick={() => setValue("isOriginal", !isOriginal, { shouldDirty: true })}
                  className={cx(styles.pill, isOriginal && styles.pillActive)}
                >
                  {isOriginal ? "✓ " : ""}
                  {t("flagOriginal")}
                </button>
              )}
            </div>
          </div>
        </div>

        {type === ProductType.SHIRT && (
          <div className={styles.section}>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t("price")}</span>
                <input inputMode="numeric" dir="ltr" className={styles.input} {...register("price")} />
                {errors.price && <span className={styles.errorText}>{t("fieldInvalid")}</span>}
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t("sale")}</span>
                <input inputMode="numeric" dir="ltr" className={styles.input} {...register("sale")} />
                {errors.sale && <span className={styles.errorText}>{errors.sale.message ?? t("fieldInvalid")}</span>}
              </label>
            </div>

            <div className={styles.rowGroup}>
              <div>
                <div className={styles.groupLabel}>{t("colors")}</div>
                <div className={styles.swatchRow}>
                  {visibleColors.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      title={locale === "ar" ? c.nameAr : c.nameEn}
                      onClick={() => toggleColor(c.code)}
                      className={cx(styles.swatch, colorCodes.includes(c.code) && styles.swatchActive)}
                      style={{ background: c.hex }}
                    />
                  ))}
                </div>
                {errors.colorCodes && <span className={styles.errorText}>{t("fieldInvalid")}</span>}
              </div>
              <div>
                <div className={styles.groupLabel}>{t("sizes")}</div>
                <div className={styles.pillRow}>
                  {visibleShirtSizes.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => toggleSize(s.code)}
                      className={cx(styles.pillSmall, sizeCodes.includes(s.code) && styles.pillActive)}
                    >
                      {s.code}
                    </button>
                  ))}
                </div>
                {errors.sizeCodes && <span className={styles.errorText}>{t("fieldInvalid")}</span>}
              </div>
            </div>

            <label className={styles.checkboxRow}>
              <input type="checkbox" {...register("trackStock")} />
              {t("trackStock")}
            </label>
            {trackStock && (
              <VariantMatrix colorCodes={colorCodes} sizeCodes={sizeCodes} colors={colors} sizes={shirtSizes} />
            )}
          </div>
        )}

        {type === ProductType.PAINTING && (
          <div className={styles.section}>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t("artistNoteAr")}</span>
                <textarea dir="rtl" rows={2} className={styles.textarea} {...register("artistNoteAr")} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t("artistNoteEn")}</span>
                <textarea dir="ltr" rows={2} className={styles.textarea} {...register("artistNoteEn")} />
              </label>
            </div>

            <div className={styles.groupLabel}>{t("sizePrices")}</div>
            <div className={styles.sizePriceRow}>
              {paintingSizes.map((size) => {
                const idx = (getValues("sizePrices") ?? []).findIndex((sp) => sp.sizeCode === size.code);
                const fieldIndex = idx >= 0 ? idx : null;
                return (
                  <label key={size.code} className={styles.sizePriceItem}>
                    <span>{size.code}</span>
                    {fieldIndex !== null ? (
                      <input
                        inputMode="numeric"
                        dir="ltr"
                        className={styles.sizePriceInput}
                        {...register(`sizePrices.${fieldIndex}.price` as const)}
                      />
                    ) : (
                      <input inputMode="numeric" dir="ltr" className={styles.sizePriceInput} disabled />
                    )}
                    <span className={styles.currencyMark}>{tCommon("currency")}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.groupLabel}>{t("images")}</div>
          <ImagesField draftId={draftIdRef.current} />
        </div>

        <div className={styles.saveRow}>
          <button type="submit" className={styles.saveBtn} disabled={isSubmitting}>
            {isSubmitting ? tCommon("saving") : t("saveProduct")}
          </button>
          {saved && <span className={styles.savedText}>✓ {tCommon("saved")}</span>}
          {serverError && <span className={styles.errorText}>{serverError}</span>}
        </div>
      </form>
    </FormProvider>
  );
}
