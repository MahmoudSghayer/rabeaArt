import { ProductType } from "@/generated/prisma/enums";
import { DEFAULT_PAGE_SIZE, type PriceBucket, type ProductSort } from "@/lib/catalog/types";

/**
 * Shop URL param contract (all optional, all with defaults so every state is a plain link):
 *
 *   cat   "all" | "shirts" | "paintings"                  default "all"
 *   q     free-text search                                 default "" (trimmed)
 *   sort  "featured" | "new" | "priceAsc" | "priceDesc"     default "featured"
 *   size  a size code (e.g. "M", "A4")                      default "" (no filter)
 *   color a color code (e.g. "sand")                        default "" (no filter)
 *   price "a" | "b" | "c" (price bucket)                    default "" (no filter)
 *   stock "1" to mean "in stock only"                       default unset (off)
 *   page  1-based page number                                default 1
 *
 * The URL is the single source of truth: the server page (`shop/page.tsx`) parses it into a
 * `ParsedShopQuery`, fetches with it, and passes the parsed values back down as props to the
 * client `ShopControls` component, which only ever writes new query strings via
 * `router.replace` — it never keeps its own copy of filter state.
 */

export type ShopCategoryParam = "all" | "shirts" | "paintings";

export const DEFAULT_SORT: ProductSort = "featured";
export const SHOP_PAGE_SIZE = DEFAULT_PAGE_SIZE;

const SORTS: readonly ProductSort[] = ["featured", "new", "priceAsc", "priceDesc"];
const BUCKETS: readonly PriceBucket[] = ["a", "b", "c"];

/** Raw values as they arrive from Next's `searchParams` (each param may be absent, one, or many). */
export type RawShopSearchParams = Record<string, string | string[] | undefined>;

export interface ParsedShopQuery {
  cat: ShopCategoryParam;
  q: string;
  sort: ProductSort;
  size: string;
  color: string;
  price: PriceBucket | "";
  stock: boolean;
  page: number;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseShopQuery(raw: RawShopSearchParams): ParsedShopQuery {
  const rawCat = first(raw.cat);
  const cat: ShopCategoryParam = rawCat === "shirts" || rawCat === "paintings" ? rawCat : "all";

  const q = (first(raw.q) ?? "").trim();

  const rawSort = first(raw.sort);
  const sort = (SORTS as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as ProductSort)
    : DEFAULT_SORT;

  const size = first(raw.size) ?? "";
  const color = first(raw.color) ?? "";

  const rawPrice = first(raw.price);
  const price = (BUCKETS as readonly string[]).includes(rawPrice ?? "") ? (rawPrice as PriceBucket) : "";

  const rawStock = first(raw.stock);
  const stock = rawStock === "1" || rawStock === "true";

  const rawPage = Number(first(raw.page));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  return { cat, q, sort, size, color, price, stock, page };
}

/** Maps the URL's `cat` param to the catalog query's `type` filter ("all" → no filter). */
export function categoryToProductType(cat: ShopCategoryParam): ProductType | undefined {
  if (cat === "shirts") return ProductType.SHIRT;
  if (cat === "paintings") return ProductType.PAINTING;
  return undefined;
}

/**
 * Builds a `{ query }` object for `Link`/`router.replace`, omitting any param that's at its
 * default (so URLs stay short and "reset" states never carry noise like `?cat=all`).
 */
export function buildShopQuery(patch: Partial<ParsedShopQuery>): Record<string, string> {
  const out: Record<string, string> = {};
  if (patch.cat && patch.cat !== "all") out.cat = patch.cat;
  if (patch.q) out.q = patch.q;
  if (patch.sort && patch.sort !== DEFAULT_SORT) out.sort = patch.sort;
  if (patch.size) out.size = patch.size;
  if (patch.color) out.color = patch.color;
  if (patch.price) out.price = patch.price;
  if (patch.stock) out.stock = "1";
  if (patch.page && patch.page > 1) out.page = String(patch.page);
  return out;
}
