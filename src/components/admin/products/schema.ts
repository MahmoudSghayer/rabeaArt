import { z } from "zod";
import { ProductType } from "@/generated/prisma/enums";

/**
 * Shared client/server validation for the product create/update form (no `server-only` import —
 * `ProductForm.tsx` uses this for client-side `zodResolver` pre-validation, and
 * `src/app/admin/products/actions.ts` re-validates the same shape authoritatively before writing
 * anything). Mirrors the pattern in `src/lib/orders/schemas.ts`.
 *
 * Every numeric field arrives as a string from RHF's controlled inputs and is coerced here.
 * Type-specific fields (shirt vs painting) are all declared optional at the object level, then
 * required/cross-checked in `superRefine` based on `type` — a discriminated union would be more
 * "correct" but RHF's `useFieldArray`/`watch` work far more smoothly against one flat shape.
 */

const productTypeSchema = z.enum(Object.values(ProductType) as [ProductType, ...ProductType[]]);

const nameSchema = z.string().trim().min(1).max(200);
const optionalTextSchema = z.string().trim().max(4000).optional();
const shortTextSchema = z.string().trim().max(300).optional();

/** Kebab-case, lowercase ASCII — matches the storefront's product-page URL segment. */
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and single hyphens.");

const moneyStringSchema = z
  .string()
  .trim()
  .refine((v) => v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1_000_000, {
    message: "Enter a valid amount.",
  });

const optionalMoneyStringSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1_000_000), {
    message: "Enter a valid amount.",
  })
  .optional();

const stockStringSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 1_000_000), {
    message: "Enter a whole number.",
  });

const variantStockSchema = z.object({
  colorCode: z.string().min(1).max(64),
  sizeCode: z.string().min(1).max(64),
  stock: stockStringSchema,
});

const sizePriceSchema = z.object({
  sizeCode: z.string().min(1).max(64),
  price: z.string().trim(),
});

const imageSchema = z.object({
  path: z.string().min(1).max(500),
  alt: z.string().trim().max(200).optional(),
  isPrimary: z.boolean(),
  sortOrder: z.number().int().min(0).max(50),
});

export const productFormSchema = z
  .object({
    id: z.string().min(1).max(64).optional(),
    type: productTypeSchema,
    nameAr: nameSchema,
    nameEn: nameSchema,
    descAr: optionalTextSchema,
    descEn: optionalTextSchema,
    slug: slugSchema,
    categoryId: z.string().min(1).max(64),
    featured: z.boolean(),
    prepAr: shortTextSchema,
    prepEn: shortTextSchema,
    displayOrder: z
      .string()
      .trim()
      .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0), { message: "Whole number." })
      .optional(),

    // Shirt-only
    price: optionalMoneyStringSchema,
    sale: optionalMoneyStringSchema,
    printAvailable: z.boolean().optional(),
    embroideryAvailable: z.boolean().optional(),
    trackStock: z.boolean().optional(),
    colorCodes: z.array(z.string().min(1).max(64)).max(50).optional(),
    sizeCodes: z.array(z.string().min(1).max(64)).max(50).optional(),
    variantStocks: z.array(variantStockSchema).max(400).optional(),

    // Painting-only
    isOriginal: z.boolean().optional(),
    artistNoteAr: optionalTextSchema,
    artistNoteEn: optionalTextSchema,
    sizePrices: z.array(sizePriceSchema).max(20).optional(),

    images: z.array(imageSchema).max(6),
  })
  .superRefine((val, ctx) => {
    if (val.type === ProductType.SHIRT) {
      if (!val.price || moneyStringSchema.safeParse(val.price).success === false) {
        ctx.addIssue({ code: "custom", path: ["price"], message: "Price is required." });
      }
      if (val.sale && val.price && Number(val.sale) >= Number(val.price)) {
        ctx.addIssue({ code: "custom", path: ["sale"], message: "Sale price must be lower than the base price." });
      }
      if (!val.colorCodes || val.colorCodes.length === 0) {
        ctx.addIssue({ code: "custom", path: ["colorCodes"], message: "Pick at least one colour." });
      }
      if (!val.sizeCodes || val.sizeCodes.length === 0) {
        ctx.addIssue({ code: "custom", path: ["sizeCodes"], message: "Pick at least one size." });
      }
    }
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;
