import { AdminRole, ProductType } from "@/generated/prisma/enums";
import { requireAdminPage } from "../../_lib/require";
import { ProductForm } from "@/components/admin/products/ProductForm";
import type { ProductFormInitialData } from "@/components/admin/products/types";
import { loadProductFormOptions } from "../formOptions";
import pageStyles from "../../admin.module.css";

/**
 * Catalog writes require ADMIN (see products/actions.ts) — gating the whole page (not just the
 * mutating action) at ADMIN too avoids rendering a form a STAFF admin can never successfully
 * submit.
 */
export default async function NewProductPage() {
  await requireAdminPage(AdminRole.ADMIN);
  const options = await loadProductFormOptions();

  const defaultCategoryId = options.categories.find((c) => c.type === ProductType.SHIRT)?.id ?? "";

  const initial: ProductFormInitialData = {
    id: null,
    type: ProductType.SHIRT,
    nameAr: "",
    nameEn: "",
    descAr: "",
    descEn: "",
    slug: "",
    categoryId: defaultCategoryId,
    featured: false,
    prepAr: "",
    prepEn: "",
    displayOrder: "0",
    price: "",
    sale: "",
    printAvailable: true,
    embroideryAvailable: false,
    trackStock: false,
    colorCodes: [],
    sizeCodes: [],
    variantStocks: [],
    isOriginal: false,
    artistNoteAr: "",
    artistNoteEn: "",
    sizePrices: options.paintingSizes.filter((s) => s.active).map((s) => ({ sizeCode: s.code, price: "" })),
    images: [],
    archived: false,
    hasOrderItems: false,
  };

  return (
    <div className={pageStyles.page}>
      <ProductForm
        initial={initial}
        categories={options.categories}
        colors={options.colors}
        shirtSizes={options.shirtSizes}
        paintingSizes={options.paintingSizes.filter((s) => s.active)}
      />
    </div>
  );
}
