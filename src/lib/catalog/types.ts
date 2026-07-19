import type { ProductType } from "@/generated/prisma/enums";

/**
 * Every localized column in the schema is a pair of `*Ar`/`*En` fields (e.g. `nameAr`/`nameEn`).
 * The catalog layer always maps both into a single `{ ar, en }` object rather than accepting a
 * `locale` parameter per call: server components already know the active next-intl locale, and
 * returning both sides keeps these queries cache/reuse-friendly (one fetch serves both locales,
 * e.g. `<html lang>` switches or admin previews). Use `pickText` below when a caller just wants
 * "the current locale's string, with a sane fallback".
 */
export type LocalizedText = { ar: string; en: string };

export type CatalogLocale = "ar" | "en";

/** Reads `locale` off a localized pair, falling back to Arabic then English if that side is empty. */
export function pickText(text: LocalizedText | null | undefined, locale: CatalogLocale): string {
  if (!text) return "";
  return text[locale] || text.ar || text.en || "";
}

export type CatalogImage = {
  path: string;
  alt: string | null;
  isPrimary: boolean;
};

export type CatalogColorOption = {
  code: string;
  name: LocalizedText;
  hex: string;
};

export type CatalogSizeOption = {
  code: string;
  label: LocalizedText;
};

export type CatalogFrameOption = {
  code: string;
  label: LocalizedText;
  /** Amount added on top of a painting's base size price when this frame is picked. */
  add: number;
};

export type CatalogMaterialOption = {
  code: string;
  label: LocalizedText;
};

export type CatalogMethodOption = {
  scope: string;
  code: string;
  label: LocalizedText;
};

/** One shirt colour x size combination, carrying its own stock count. */
export type CatalogVariant = {
  colorCode: string;
  sizeCode: string;
  stock: number;
  active: boolean;
};

/** One painting size, priced independently (frames are added on top at order time). */
export type CatalogPaintingSize = {
  code: string;
  label: LocalizedText;
  price: number;
};

export type CatalogListItem = {
  id: string;
  slug: string;
  type: ProductType;
  name: LocalizedText;
  primaryImage: CatalogImage | null;
  colors: CatalogColorOption[];
  /**
   * The price shown on a card: for shirts, `sale ?? price`; for paintings, the cheapest
   * configured size. Null only for a mid-setup product with no price/size configured yet
   * (never true for a fully seeded/published row).
   */
  displayPrice: number | null;
  /** Set only when a shirt is on sale, so the UI can render `price` struck through next to `displayPrice`. */
  oldPrice: number | null;
  isOriginal: boolean;
  featured: boolean;
  inStock: boolean;
};

export type CatalogProductDetail = CatalogListItem & {
  description: LocalizedText | null;
  images: CatalogImage[];
  artistNote: LocalizedText | null;
  prep: LocalizedText | null;
  printAvailable: boolean;
  embroideryAvailable: boolean;
  /** Derived from printAvailable/embroideryAvailable; always empty for paintings. */
  availableMethods: Array<"print" | "embroidery">;
  /** Shirts only — distinct sizes across this product's variants, sorted by Size.sortOrder. */
  shirtSizes: CatalogSizeOption[];
  /** Shirts only — every colour x size combination with its own stock/active state. */
  variants: CatalogVariant[];
  /** Paintings only — offered sizes with their own price. */
  paintingSizes: CatalogPaintingSize[];
  /** All active frames (global option list — not product-specific). */
  frames: CatalogFrameOption[];
};

export type CatalogActiveOptions = {
  shirtSizes: CatalogSizeOption[];
  paintingSizes: CatalogSizeOption[];
  colors: CatalogColorOption[];
  frames: CatalogFrameOption[];
  materials: CatalogMaterialOption[];
  methodsByScope: Record<string, CatalogMethodOption[]>;
};

export type CatalogSettings = {
  whatsapp: string;
  email: string;
  instagram: string | null;
  announcement: LocalizedText;
  announcementActive: boolean;
  customOtherEnabled: boolean;
};

export type PriceBucket = "a" | "b" | "c";
export type ProductSort = "featured" | "new" | "priceAsc" | "priceDesc";

export type ListProductsOptions = {
  type?: ProductType;
  search?: string;
  colorCode?: string;
  sizeCode?: string;
  priceBucket?: PriceBucket;
  inStockOnly?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

export type ListProductsResult = {
  items: CatalogListItem[];
  total: number;
  page: number;
  pageCount: number;
};

/**
 * Catalog sizes are small (tens of rows total), so `listProducts` fetches every row matching
 * the cheap DB-level filters (archived/type/search/colour/size) and does price-bucket
 * filtering, sorting, and pagination in JS — see the comment above `listProducts` for why.
 * This cap just keeps a caller from accidentally requesting an unbounded page.
 */
export const MAX_PAGE_SIZE = 48;
export const DEFAULT_PAGE_SIZE = 12;
