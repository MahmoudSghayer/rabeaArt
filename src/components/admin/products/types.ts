import type { ProductType } from "@/generated/prisma/enums";

/**
 * Shared shapes between the product form's server pages (new/[id]/edit) and the client form
 * component. Kept separate from `schema.ts` (the zod submission contract) because this describes
 * *read* shapes (option lists, initial values) rather than the payload posted back to the server.
 */

export type CategoryOption = { id: string; type: ProductType; nameAr: string; nameEn: string };
export type ColorOption = { code: string; nameAr: string; nameEn: string; hex: string; active: boolean };
export type SizeOption = { code: string; labelAr: string; labelEn: string; active: boolean };

export type ProductFormImage = {
  /** Bucket-relative path in the "product-images" bucket. */
  path: string;
  alt: string;
  isPrimary: boolean;
  sortOrder: number;
};

/**
 * Initial values fed into `<ProductForm>`. `new/page.tsx` builds one with sensible empty
 * defaults; `[id]/edit/page.tsx` builds one from the loaded Product row. Every numeric value is
 * carried as a string (RHF-friendly controlled inputs) — `schema.ts` coerces back to numbers.
 */
export type ProductFormInitialData = {
  id: string | null;
  type: ProductType;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  slug: string;
  categoryId: string;
  featured: boolean;
  prepAr: string;
  prepEn: string;
  displayOrder: string;

  // Shirt-only
  price: string;
  sale: string;
  printAvailable: boolean;
  embroideryAvailable: boolean;
  trackStock: boolean;
  colorCodes: string[];
  sizeCodes: string[];
  variantStocks: { colorCode: string; sizeCode: string; stock: string }[];

  // Painting-only
  isOriginal: boolean;
  artistNoteAr: string;
  artistNoteEn: string;
  sizePrices: { sizeCode: string; price: string }[];

  images: ProductFormImage[];

  /** Existing-product-only metadata the toolbar needs (archive/delete affordances). */
  archived: boolean;
  hasOrderItems: boolean;
};
