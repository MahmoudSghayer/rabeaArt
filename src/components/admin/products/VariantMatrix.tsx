"use client";

import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { useLocale, useTranslations } from "next-intl";
import type { SupportedLocale } from "@/i18n/routing";
import type { ColorOption, SizeOption } from "./types";
import type { ProductFormValues } from "./schema";
import styles from "./ProductForm.module.css";

export interface VariantMatrixProps {
  colorCodes: string[];
  sizeCodes: string[];
  colors: ColorOption[];
  sizes: SizeOption[];
}

/**
 * Stock-per-combo grid for tracked shirts: one row per selected color, one column per selected
 * size. Reads/writes `variantStocks` (kept in sync with `colorCodes`/`sizeCodes` by ProductForm's
 * `syncVariantMatrix`, see that file) via `register`, looked up by combo key rather than by
 * array index so the grid layout can follow the canonical color/size order regardless of the
 * order combos were added to the field array.
 */
export function VariantMatrix({ colorCodes, sizeCodes, colors, sizes }: VariantMatrixProps) {
  const t = useTranslations("adminProductForm");
  const locale = useLocale() as SupportedLocale;
  const { register, watch } = useFormContext<ProductFormValues>();
  const variantStocksRaw = watch("variantStocks");

  const indexByCombo = useMemo(() => {
    const map = new Map<string, number>();
    (variantStocksRaw ?? []).forEach((v, i) => map.set(`${v.colorCode}:${v.sizeCode}`, i));
    return map;
  }, [variantStocksRaw]);

  const rowColors = colors.filter((c) => colorCodes.includes(c.code));
  const colSizes = sizes.filter((s) => sizeCodes.includes(s.code));

  if (rowColors.length === 0 || colSizes.length === 0) {
    return <p className={styles.hint}>{t("variantMatrixEmpty")}</p>;
  }

  return (
    <div className={styles.matrixWrap}>
      <table className={styles.matrixTable}>
        <thead>
          <tr>
            <th />
            {colSizes.map((s) => (
              <th key={s.code}>{s.code}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowColors.map((color) => (
            <tr key={color.code}>
              <th className={styles.matrixRowLabel}>
                <span className={styles.matrixSwatch} style={{ background: color.hex }} aria-hidden="true" />
                {locale === "ar" ? color.nameAr : color.nameEn}
              </th>
              {colSizes.map((size) => {
                const idx = indexByCombo.get(`${color.code}:${size.code}`);
                return (
                  <td key={size.code}>
                    {idx !== undefined ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        dir="ltr"
                        className={styles.matrixInput}
                        {...register(`variantStocks.${idx}.stock` as const)}
                      />
                    ) : (
                      <span className={styles.matrixInputDisabled}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
