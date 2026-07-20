import "server-only";
import { prisma } from "@/lib/prisma";
import { SizeScope } from "@/generated/prisma/enums";
import type { CategoryOption, ColorOption, SizeOption } from "@/components/admin/products/types";

export type ProductFormOptions = {
  categories: CategoryOption[];
  /** All colors (active + inactive) — ProductForm filters to active-or-already-selected so an
   * existing product's since-deactivated colour stays visible/toggleable on its own edit page. */
  colors: ColorOption[];
  shirtSizes: SizeOption[];
  /** PAINTING-scope sizes, "custom" excluded (always manually priced, no fixed price row). */
  paintingSizes: SizeOption[];
};

/** Shared option-list loader for both `new/page.tsx` and `[id]/edit/page.tsx` — one query shape
 * for the category/colour/size pickers both product-form pages need. */
export async function loadProductFormOptions(): Promise<ProductFormOptions> {
  const [categories, colors, sizes] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.color.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.size.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return {
    categories: categories.map((c) => ({ id: c.id, type: c.type, nameAr: c.nameAr, nameEn: c.nameEn })),
    colors: colors.map((c) => ({ code: c.code, nameAr: c.nameAr, nameEn: c.nameEn, hex: c.hex, active: c.active })),
    shirtSizes: sizes
      .filter((s) => s.scope === SizeScope.SHIRT)
      .map((s) => ({ code: s.code, labelAr: s.labelAr, labelEn: s.labelEn, active: s.active })),
    paintingSizes: sizes
      .filter((s) => s.scope === SizeScope.PAINTING && s.code !== "custom")
      .map((s) => ({ code: s.code, labelAr: s.labelAr, labelEn: s.labelEn, active: s.active })),
  };
}
