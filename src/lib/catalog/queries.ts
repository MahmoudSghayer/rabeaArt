import "server-only";
import { prisma } from "@/lib/prisma";
import { ProductType, SizeScope } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductInclude, ProductWhereInput } from "@/generated/prisma/models";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type CatalogActiveOptions,
  type CatalogColorOption,
  type CatalogFrameOption,
  type CatalogImage,
  type CatalogListItem,
  type CatalogMaterialOption,
  type CatalogMethodOption,
  type CatalogPaintingSize,
  type CatalogProductDetail,
  type CatalogSettings,
  type CatalogSizeOption,
  type CatalogVariant,
  type ListProductsOptions,
  type ListProductsResult,
  type LocalizedText,
  type PriceBucket,
  type ProductSort,
} from "@/lib/catalog/types";

/**
 * Shared `include` for every query that returns a `CatalogListItem`/`CatalogProductDetail` —
 * one shape keeps the row mapper (`mapCatalogListItem`/`mapCatalogProductDetail`) usable from
 * `listProducts`, `getProductBySlug`, `getRelatedProducts`, and `getFeaturedProducts` alike.
 * Catalogs here are tens of rows, so the modest over-fetch (e.g. variants on a list card) is
 * cheaper than maintaining two includes.
 */
const catalogProductInclude = {
  images: true,
  colors: { include: { color: true } },
  sizes: { include: { size: true } },
  variants: { include: { color: true, size: true } },
} satisfies ProductInclude;

/**
 * Derived from the actual query args (rather than hand-assembled via `ProductGetPayload`) so
 * this type always matches `catalogProductInclude` exactly — if the include changes, this and
 * every mapper below fail to compile instead of silently drifting.
 */
type CatalogProductRow = Prisma.Result<typeof prisma.product, { include: typeof catalogProductInclude }, "findMany">[number];

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

function localizedOrNull(ar: string | null, en: string | null): LocalizedText | null {
  if (ar === null && en === null) return null;
  return { ar: ar ?? "", en: en ?? "" };
}

function sortedImages(row: CatalogProductRow): CatalogImage[] {
  return [...row.images]
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    })
    .map((img) => ({ path: img.path, alt: img.alt, isPrimary: img.isPrimary }));
}

function mapColors(row: CatalogProductRow): CatalogColorOption[] {
  return [...row.colors]
    .sort((a, b) => a.color.sortOrder - b.color.sortOrder)
    .map((pc) => ({
      code: pc.color.code,
      name: { ar: pc.color.nameAr, en: pc.color.nameEn },
      hex: pc.color.hex,
    }));
}

function computeDisplayPrice(row: CatalogProductRow): { displayPrice: number | null; oldPrice: number | null } {
  if (row.type === ProductType.SHIRT) {
    const price = decimalToNumber(row.price);
    const sale = decimalToNumber(row.sale);
    return sale !== null ? { displayPrice: sale, oldPrice: price } : { displayPrice: price, oldPrice: null };
  }
  // PAINTING: the card shows the cheapest configured size; frames/custom sizing are add-ons
  // decided at order time, not part of the "from" price.
  const prices = row.sizes.map((s) => Number(s.price));
  return prices.length > 0 ? { displayPrice: Math.min(...prices), oldPrice: null } : { displayPrice: null, oldPrice: null };
}

/**
 * `trackStock` is an opt-in flag ("shirts only, opt-in" per schema) — a shirt that never turned
 * it on has no stock ceiling, so it's treated as always orderable. Paintings don't use variant
 * stock at all (originals are one-of-a-kind by nature, prints are made to order), so they're
 * always available once published; callers must still exclude archived rows themselves (all
 * queries here already filter `archived: false`).
 */
function computeInStock(row: CatalogProductRow): boolean {
  if (row.type === ProductType.PAINTING) return true;
  if (!row.trackStock) return true;
  return row.variants.some((v) => v.active && v.stock > 0);
}

function mapCatalogListItem(row: CatalogProductRow): CatalogListItem {
  const { displayPrice, oldPrice } = computeDisplayPrice(row);
  const images = sortedImages(row);
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    name: { ar: row.nameAr, en: row.nameEn },
    primaryImage: images[0] ?? null,
    colors: mapColors(row),
    displayPrice,
    oldPrice,
    isOriginal: row.isOriginal,
    featured: row.featured,
    inStock: computeInStock(row),
  };
}

function mapCatalogProductDetail(row: CatalogProductRow, frames: CatalogFrameOption[]): CatalogProductDetail {
  const base = mapCatalogListItem(row);

  const availableMethods: Array<"print" | "embroidery"> = [];
  if (row.printAvailable) availableMethods.push("print");
  if (row.embroideryAvailable) availableMethods.push("embroidery");

  const sizeByCode = new Map<string, { code: string; labelAr: string; labelEn: string; sortOrder: number }>();
  const variants: CatalogVariant[] = [];
  for (const v of row.variants) {
    if (v.size && !sizeByCode.has(v.size.code)) {
      sizeByCode.set(v.size.code, {
        code: v.size.code,
        labelAr: v.size.labelAr,
        labelEn: v.size.labelEn,
        sortOrder: v.size.sortOrder,
      });
    }
    if (v.color && v.size) {
      variants.push({ colorCode: v.color.code, sizeCode: v.size.code, stock: v.stock, active: v.active });
    }
  }
  const shirtSizes: CatalogSizeOption[] = [...sizeByCode.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => ({ code: s.code, label: { ar: s.labelAr, en: s.labelEn } }));

  const paintingSizes: CatalogPaintingSize[] = [...row.sizes]
    .sort((a, b) => a.size.sortOrder - b.size.sortOrder)
    .map((ps) => ({
      code: ps.size.code,
      label: { ar: ps.size.labelAr, en: ps.size.labelEn },
      price: Number(ps.price),
    }));

  return {
    ...base,
    description: localizedOrNull(row.descAr, row.descEn),
    images: sortedImages(row),
    artistNote: localizedOrNull(row.artistNoteAr, row.artistNoteEn),
    prep: localizedOrNull(row.prepAr, row.prepEn),
    printAvailable: row.printAvailable,
    embroideryAvailable: row.embroideryAvailable,
    availableMethods,
    shirtSizes,
    variants,
    paintingSizes,
    frames,
  };
}

function mapFrame(f: { code: string; labelAr: string; labelEn: string; add: Prisma.Decimal }): CatalogFrameOption {
  return { code: f.code, label: { ar: f.labelAr, en: f.labelEn }, add: Number(f.add) };
}

async function listActiveFrames(): Promise<CatalogFrameOption[]> {
  const rows = await prisma.frame.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return rows.map(mapFrame);
}

function matchesPriceBucket(price: number | null, bucket: PriceBucket): boolean {
  if (price === null) return false;
  if (bucket === "a") return price < 100;
  if (bucket === "b") return price >= 100 && price <= 200;
  return price > 200; // "c"
}

type ScoredItem = { item: CatalogListItem; createdAt: Date; displayOrder: number };

function sortScored(rows: ScoredItem[], sort: ProductSort): ScoredItem[] {
  const arr = [...rows];
  switch (sort) {
    case "new":
      arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
    case "priceAsc":
      arr.sort((a, b) => (a.item.displayPrice ?? Number.POSITIVE_INFINITY) - (b.item.displayPrice ?? Number.POSITIVE_INFINITY));
      break;
    case "priceDesc":
      arr.sort((a, b) => (b.item.displayPrice ?? Number.NEGATIVE_INFINITY) - (a.item.displayPrice ?? Number.NEGATIVE_INFINITY));
      break;
    case "featured":
    default:
      arr.sort((a, b) => Number(b.item.featured) - Number(a.item.featured) || a.displayOrder - b.displayOrder);
  }
  return arr;
}

/**
 * Storefront listing (shop grid + filters). Only `archived`/`type`/`search`/`colorCode`/
 * `sizeCode` are pushed down to Postgres — those map onto indexed columns or simple joins.
 * `priceBucket`, `inStockOnly`, price sorting, and pagination all happen in JS after the fetch,
 * because `displayPrice` is a computed value (sale-or-price for shirts, min ProductSize for
 * paintings) that Prisma can't order/filter by in a single query. This is fine at this store's
 * scale — total product count is in the tens, not thousands — but would need a materialized
 * price column (or raw SQL) to stay correct if the catalog grew substantially.
 */
export async function listProducts(opts: ListProductsOptions = {}): Promise<ListProductsResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE));

  const conditions: ProductWhereInput[] = [{ archived: false }];
  if (opts.type) conditions.push({ type: opts.type });

  const search = opts.search?.trim();
  if (search) {
    conditions.push({
      OR: [
        { nameAr: { contains: search, mode: "insensitive" } },
        { nameEn: { contains: search, mode: "insensitive" } },
        { descAr: { contains: search, mode: "insensitive" } },
        { descEn: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (opts.colorCode) {
    conditions.push({ colors: { some: { color: { code: opts.colorCode } } } });
  }
  if (opts.sizeCode) {
    // A product can be a shirt (sizes live on variants) or a painting (sizes live on
    // ProductSize) — OR across both relations so the one filter works for either type.
    conditions.push({
      OR: [
        { variants: { some: { active: true, size: { code: opts.sizeCode } } } },
        { sizes: { some: { size: { code: opts.sizeCode } } } },
      ],
    });
  }

  const rows = await prisma.product.findMany({
    where: { AND: conditions },
    include: catalogProductInclude,
  });

  let scored: ScoredItem[] = rows.map((row) => ({
    item: mapCatalogListItem(row),
    createdAt: row.createdAt,
    displayOrder: row.displayOrder,
  }));

  if (opts.priceBucket) {
    const bucket = opts.priceBucket;
    scored = scored.filter((s) => matchesPriceBucket(s.item.displayPrice, bucket));
  }
  if (opts.inStockOnly) {
    scored = scored.filter((s) => s.item.inStock);
  }

  scored = sortScored(scored, opts.sort ?? "featured");

  const total = scored.length;
  const pageCount = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const items = scored.slice(start, start + pageSize).map((s) => s.item);

  return { items, total, page, pageCount };
}

/** Full detail for a product page. Returns null for a missing or archived slug. */
export async function getProductBySlug(slug: string): Promise<CatalogProductDetail | null> {
  const [row, frames] = await Promise.all([
    prisma.product.findUnique({ where: { slug }, include: catalogProductInclude }),
    listActiveFrames(),
  ]);
  if (!row || row.archived) return null;
  return mapCatalogProductDetail(row, frames);
}

/** Same-type products for a "you might also like" rail — featured first, then catalog order. */
export async function getRelatedProducts(
  productId: string,
  type: ProductType,
  limit = 4,
): Promise<CatalogListItem[]> {
  const rows = await prisma.product.findMany({
    where: { type, archived: false, id: { not: productId } },
    include: catalogProductInclude,
    orderBy: [{ featured: "desc" }, { displayOrder: "asc" }],
    take: limit,
  });
  return rows.map(mapCatalogListItem);
}

/** Featured products across both shirts and paintings, for the homepage. */
export async function getFeaturedProducts(limit = 6): Promise<CatalogListItem[]> {
  const rows = await prisma.product.findMany({
    where: { featured: true, archived: false },
    include: catalogProductInclude,
    orderBy: [{ displayOrder: "asc" }],
    take: limit,
  });
  return rows.map(mapCatalogListItem);
}

/** Active option lists for shop filters and the custom-order wizard — everything ordered by sortOrder. */
export async function listActiveOptions(): Promise<CatalogActiveOptions> {
  const [sizes, colors, frames, materials, methods] = await Promise.all([
    prisma.size.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.color.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    listActiveFrames(),
    prisma.material.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.productionMethod.findMany({ where: { active: true }, orderBy: [{ scope: "asc" }, { sortOrder: "asc" }] }),
  ]);

  const colorOptions: CatalogColorOption[] = colors.map((c) => ({
    code: c.code,
    name: { ar: c.nameAr, en: c.nameEn },
    hex: c.hex,
  }));
  const materialOptions: CatalogMaterialOption[] = materials.map((m) => ({
    code: m.code,
    label: { ar: m.labelAr, en: m.labelEn },
  }));
  const toSizeOption = (s: { code: string; labelAr: string; labelEn: string }): CatalogSizeOption => ({
    code: s.code,
    label: { ar: s.labelAr, en: s.labelEn },
  });

  const methodsByScope: Record<string, CatalogMethodOption[]> = {};
  for (const m of methods) {
    const option: CatalogMethodOption = { scope: m.scope, code: m.code, label: { ar: m.labelAr, en: m.labelEn } };
    (methodsByScope[m.scope] ??= []).push(option);
  }

  return {
    shirtSizes: sizes.filter((s) => s.scope === SizeScope.SHIRT).map(toSizeOption),
    paintingSizes: sizes.filter((s) => s.scope === SizeScope.PAINTING).map(toSizeOption),
    colors: colorOptions,
    frames,
    materials: materialOptions,
    methodsByScope,
  };
}

/** Matches the seed defaults in prisma/seed.ts — used only if the Settings singleton is missing. */
const DEFAULT_SETTINGS: CatalogSettings = {
  whatsapp: "+972 50 000 0000",
  email: "hello@rabea.art",
  instagram: "@rabea.art",
  announcement: {
    ar: "الطلبات المخصصة مفتوحة هذا الشهر — التسليم قبل العيد مضمون للطلبات المؤكدة قبل ١٠ أيام.",
    en: "Custom orders are open this month — pre-holiday delivery guaranteed for orders confirmed 10 days ahead.",
  },
  announcementActive: true,
  customOtherEnabled: true,
};

/** Never throws for a missing row — site chrome (WhatsApp link, announcement bar) must always render. */
export async function getSettings(): Promise<CatalogSettings> {
  const row = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!row) return DEFAULT_SETTINGS;
  return {
    whatsapp: row.whatsapp,
    email: row.email,
    instagram: row.instagram,
    announcement: { ar: row.announcementAr ?? "", en: row.announcementEn ?? "" },
    announcementActive: row.announcementActive,
    customOtherEnabled: row.customOtherEnabled,
  };
}
