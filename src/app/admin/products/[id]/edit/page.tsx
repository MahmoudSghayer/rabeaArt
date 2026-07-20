import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";
import { requireAdminPage } from "../../../_lib/require";
import { createTranslator, getAdminLocale, getAdminMessages } from "../../../_lib/messages";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { ProductToolbar } from "@/components/admin/products/ProductToolbar";
import type { ProductFormInitialData } from "@/components/admin/products/types";
import { loadProductFormOptions } from "../../formOptions";
import pageStyles from "../../../admin.module.css";

async function loadProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      colors: { include: { color: true } },
      sizes: { include: { size: true } },
      variants: { include: { color: true, size: true } },
      _count: { select: { orderItems: true } },
    },
  });
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage(AdminRole.ADMIN);
  const { id } = await params;
  const locale = await getAdminLocale();

  let product: Awaited<ReturnType<typeof loadProduct>> | null = null;
  let loadFailed = false;
  try {
    product = await loadProduct(id);
  } catch (err) {
    console.error("EditProductPage: failed to load product", err);
    loadFailed = true;
  }

  if (!product && !loadFailed) notFound();

  if (!product) {
    const t = createTranslator(await getAdminMessages(locale), "adminCommon");
    return (
      <div className={pageStyles.page}>
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 40 }}>{t("errorGeneric")}</div>
      </div>
    );
  }

  let options: Awaited<ReturnType<typeof loadProductFormOptions>>;
  try {
    options = await loadProductFormOptions();
  } catch (err) {
    console.error("EditProductPage: failed to load form options", err);
    const t = createTranslator(await getAdminMessages(locale), "adminCommon");
    return (
      <div className={pageStyles.page}>
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 40 }}>{t("errorGeneric")}</div>
      </div>
    );
  }

  // A painting size the product was priced under before it was deactivated stays offered on its
  // own edit form (union of active options + this product's already-priced sizes).
  const pricedSizeCodes = new Set(product.sizes.map((ps) => ps.size.code));
  const paintingSizesForForm = [
    ...options.paintingSizes.filter((s) => s.active || pricedSizeCodes.has(s.code)),
  ];

  const initial: ProductFormInitialData = {
    id: product.id,
    type: product.type,
    nameAr: product.nameAr,
    nameEn: product.nameEn,
    descAr: product.descAr ?? "",
    descEn: product.descEn ?? "",
    slug: product.slug,
    categoryId: product.categoryId,
    featured: product.featured,
    prepAr: product.prepAr ?? "",
    prepEn: product.prepEn ?? "",
    displayOrder: String(product.displayOrder),
    price: product.price !== null ? String(Number(product.price)) : "",
    sale: product.sale !== null ? String(Number(product.sale)) : "",
    printAvailable: product.printAvailable,
    embroideryAvailable: product.embroideryAvailable,
    trackStock: product.trackStock,
    colorCodes: product.colors.map((pc) => pc.color.code),
    sizeCodes: [...new Set(product.variants.filter((v) => v.size).map((v) => v.size!.code))],
    variantStocks: product.variants
      .filter((v) => v.color && v.size)
      .map((v) => ({ colorCode: v.color!.code, sizeCode: v.size!.code, stock: String(v.stock) })),
    isOriginal: product.isOriginal,
    artistNoteAr: product.artistNoteAr ?? "",
    artistNoteEn: product.artistNoteEn ?? "",
    sizePrices: paintingSizesForForm.map((s) => {
      const existing = product.sizes.find((ps) => ps.size.code === s.code);
      return { sizeCode: s.code, price: existing ? String(Number(existing.price)) : "" };
    }),
    images: product.images.map((img) => ({
      path: img.path,
      alt: img.alt ?? "",
      isPrimary: img.isPrimary,
      sortOrder: img.sortOrder,
    })),
    archived: product.archived,
    hasOrderItems: product._count.orderItems > 0,
  };

  return (
    <div className={pageStyles.page}>
      <ProductToolbar productId={product.id} archived={product.archived} hasOrderItems={initial.hasOrderItems} />
      <ProductForm
        initial={initial}
        categories={options.categories}
        colors={options.colors}
        shirtSizes={options.shirtSizes}
        paintingSizes={paintingSizesForForm}
      />
    </div>
  );
}
