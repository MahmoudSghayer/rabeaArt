import { ProductType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * URL-param contract for the products grid (`/admin/products`), mirroring the shape of
 * `src/app/admin/orders/query.ts` (that module isn't imported from here — it lives under the
 * other agent's `admin/orders/**` ownership, so this stays a self-contained duplicate of the
 * same tiny pattern rather than a cross-folder dependency).
 *
 * URL params:
 *  - `q`: free-text search against nameAr/nameEn (case-insensitive contains).
 *  - `type`: "SHIRT" | "PAINTING" (empty = both).
 *  - `archived`: "1" to include archived products (default: hidden).
 *  - `page`: 1-based page number (page size: PRODUCTS_PAGE_SIZE).
 */

export const PRODUCTS_PAGE_SIZE = 24;

export type ProductsSearchParams = Record<string, string | string[] | undefined>;

export interface ParsedProductsQuery {
  q: string | null;
  type: ProductType | null;
  showArchived: boolean;
  page: number;
}

const VALID_TYPES = new Set<string>(Object.values(ProductType));

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseProductsQuery(params: ProductsSearchParams): ParsedProductsQuery {
  const q = firstValue(params.q)?.trim() || null;
  const typeRaw = firstValue(params.type);
  const type = typeRaw && VALID_TYPES.has(typeRaw) ? (typeRaw as ProductType) : null;
  const showArchived = firstValue(params.archived) === "1";
  const pageRaw = Number(firstValue(params.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  return { q, type, showArchived, page };
}

export function buildProductsWhere(parsed: ParsedProductsQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];
  if (!parsed.showArchived) and.push({ archived: false });
  if (parsed.type) and.push({ type: parsed.type });
  if (parsed.q) {
    and.push({
      OR: [
        { nameAr: { contains: parsed.q, mode: "insensitive" } },
        { nameEn: { contains: parsed.q, mode: "insensitive" } },
      ],
    });
  }
  return and.length > 0 ? { AND: and } : {};
}
