import { prisma } from "@/lib/prisma";
import { ProductType } from "@/generated/prisma/enums";
import { requireAdminPage } from "../_lib/require";
import { createTranslator, getAdminLocale, getAdminMessages } from "../_lib/messages";
import {
  PRODUCTS_PAGE_SIZE,
  buildProductsWhere,
  firstValue,
  parseProductsQuery,
  type ProductsSearchParams,
} from "./query";
import { ProductsFilterBar, type ProductsFilterValues } from "./ProductsFilterBar";
import { ProductsGrid, type ProductCardRow } from "./ProductsGrid";
import pageStyles from "../admin.module.css";

function buildBaseQueryString(params: ProductsSearchParams): string {
  const qs = new URLSearchParams();
  const q = firstValue(params.q);
  const type = firstValue(params.type);
  const archived = firstValue(params.archived);
  if (q) qs.set("q", q);
  if (type) qs.set("type", type);
  if (archived === "1") qs.set("archived", "1");
  return qs.toString();
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<ProductsSearchParams>;
}) {
  await requireAdminPage();
  const rawParams = await searchParams;
  const parsed = parseProductsQuery(rawParams);
  const locale = await getAdminLocale();

  const where = buildProductsWhere(parsed);
  const skip = (parsed.page - 1) * PRODUCTS_PAGE_SIZE;

  let rows: ProductCardRow[] = [];
  let total = 0;
  let loadError = false;

  try {
    const [items, count] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ featured: "desc" }, { displayOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: PRODUCTS_PAGE_SIZE,
        select: {
          id: true,
          slug: true,
          type: true,
          nameAr: true,
          nameEn: true,
          price: true,
          sale: true,
          featured: true,
          archived: true,
          category: { select: { nameAr: true, nameEn: true } },
          images: { where: { isPrimary: true }, take: 1, select: { path: true } },
          sizes: { select: { price: true } },
          variants: { where: { active: true }, select: { stock: true } },
          trackStock: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    total = count;
    rows = items.map((p) => {
      const minSizePrice = p.sizes.length > 0 ? Math.min(...p.sizes.map((s) => Number(s.price))) : null;
      const stock =
        p.type === ProductType.SHIRT && p.trackStock
          ? p.variants.reduce((sum, v) => sum + v.stock, 0)
          : null;
      return {
        id: p.id,
        slug: p.slug,
        type: p.type,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        categoryNameAr: p.category.nameAr,
        categoryNameEn: p.category.nameEn,
        imagePath: p.images[0]?.path ?? null,
        price: p.price !== null ? Number(p.price) : null,
        sale: p.sale !== null ? Number(p.sale) : null,
        fromPrice: minSizePrice,
        stock,
        featured: p.featured,
        archived: p.archived,
      };
    });
  } catch (err) {
    console.error("AdminProductsPage: failed to load products", err);
    loadError = true;
  }

  const baseQuery = buildBaseQueryString(rawParams);
  const filterInitial: ProductsFilterValues = {
    q: firstValue(rawParams.q) ?? "",
    type: firstValue(rawParams.type) ?? "",
    archived: firstValue(rawParams.archived) === "1",
  };

  const loadErrorText = loadError
    ? createTranslator(await getAdminMessages(locale), "adminProducts")("loadError")
    : null;

  return (
    <div className={pageStyles.page}>
      <ProductsFilterBar key={baseQuery} initial={filterInitial} />
      {loadErrorText ? (
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 20 }}>{loadErrorText}</div>
      ) : (
        <ProductsGrid rows={rows} total={total} page={parsed.page} pageSize={PRODUCTS_PAGE_SIZE} baseQuery={baseQuery} />
      )}
    </div>
  );
}
