"use server";

import { revalidatePath, updateTag } from "next/cache";
import { CATALOG_TAGS } from "@/lib/catalog/cache-tags";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AdminRole, ProductType, SizeScope } from "@/generated/prisma/enums";
import { requireRole, AuthError } from "@/lib/auth/requireRole";
import { PRODUCT_IMAGES_BUCKET, removeObject } from "@/lib/storage/uploads";
import { productFormSchema, type ProductFormValues } from "@/components/admin/products/schema";

/**
 * Every mutation below follows the project's established server-action shape (see
 * src/app/admin/orders/[id]/actions.ts, the canonical reference): `requireRole` first, zod
 * validation, the mutation + its `AuditLog` row inside one `prisma.$transaction`, a typed
 * `{ ok, error? }` return rather than a thrown error across the server/client boundary, and
 * `revalidatePath` for every page that shows the changed data.
 *
 * All mutations here require `AdminRole.ADMIN` (not the orders module's `STAFF` floor) — per the
 * project plan, catalog/options/settings writes are an admin-only action, unlike day-to-day order
 * handling which any staff member can do.
 */
export type ActionResult = { ok: true } | { ok: false; error: string; details?: string };
export type SaveProductResult = ActionResult & { id?: string };

class ProductActionError extends Error {
  constructor(public code: "NOT_FOUND" | "HAS_ORDERS") {
    super(code);
    this.name = "ProductActionError";
  }
}

function toActionError(err: unknown, fallback: string): ActionResult {
  if (err instanceof AuthError) return { ok: false, error: "FORBIDDEN" };
  if (err instanceof ProductActionError) return { ok: false, error: err.code };
  console.error(fallback, err);
  return { ok: false, error: fallback };
}

/** Best-effort storage cleanup for images no longer referenced by any product — never blocks or
 * fails the caller; a leaked object here is a minor storage-cost issue, not a data-integrity one. */
async function removeImagesBestEffort(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map(async (path) => {
      try {
        await removeObject(PRODUCT_IMAGES_BUCKET, path);
      } catch (err) {
        console.error(`products/actions: failed to remove orphaned image "${path}"`, err);
      }
    }),
  );
}

export async function toggleFeaturedAction(productId: string, featured: boolean): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) throw new ProductActionError("NOT_FOUND");
      await tx.product.update({ where: { id: productId }, data: { featured } });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "product.featured.toggle",
          targetType: "Product",
          targetId: productId,
          metadata: { featured },
        },
      });
    });
    revalidatePath("/admin/products");
    updateTag(CATALOG_TAGS.products);
    return { ok: true };
  } catch (err) {
    return toActionError(err, "FEATURED_UPDATE_FAILED");
  }
}

export async function setArchivedAction(productId: string, archived: boolean): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true } });
      if (!product) throw new ProductActionError("NOT_FOUND");
      await tx.product.update({
        where: { id: productId },
        data: { archived, archivedAt: archived ? new Date() : null },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: archived ? "product.archive" : "product.unarchive",
          targetType: "Product",
          targetId: productId,
          metadata: {},
        },
      });
    });
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${productId}/edit`);
    updateTag(CATALOG_TAGS.products);
    return { ok: true };
  } catch (err) {
    return toActionError(err, "ARCHIVE_UPDATE_FAILED");
  }
}

/** Never hard-deletes a product once it has OrderItems (the FK would reject it anyway) — the
 * edit page hides the Delete button in that case, and this re-checks server-side regardless. */
export async function deleteProductAction(productId: string): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.ADMIN);
    let imagePaths: string[] = [];

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, images: { select: { path: true } }, _count: { select: { orderItems: true } } },
      });
      if (!product) throw new ProductActionError("NOT_FOUND");
      if (product._count.orderItems > 0) throw new ProductActionError("HAS_ORDERS");

      imagePaths = product.images.map((i) => i.path);
      // Cascades ProductImage/ProductColor/ProductSize/ProductVariant (see schema's onDelete: Cascade).
      await tx.product.delete({ where: { id: productId } });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "product.delete", targetType: "Product", targetId: productId, metadata: {} },
      });
    });

    await removeImagesBestEffort(imagePaths);
    revalidatePath("/admin/products");
    updateTag(CATALOG_TAGS.products);
    return { ok: true };
  } catch (err) {
    return toActionError(err, "DELETE_FAILED");
  }
}

/**
 * Regenerates ProductColor + ProductVariant rows for a SHIRT product from its selected
 * color/size sets. Variant rows exist regardless of `trackStock` — a color x size combo is only
 * orderable on the storefront if it has a ProductVariant row (see `priceShirtItem` in
 * src/lib/orders/submit.ts, which looks one up and rejects the order item if it's missing) — so
 * this always regenerates the full combo set, tracked or not; `trackStock` only decides whether
 * the admin UI shows/edits real stock numbers.
 *
 * A combo removed from the selection (a color or size got unchecked) is deleted only if no
 * OrderItem references its variant; otherwise it's deactivated (`active: false`) so historical
 * orders keep a valid FK and the storefront stops offering it.
 */
async function syncShirtRelations(
  tx: Prisma.TransactionClient,
  productId: string,
  input: ProductFormValues,
): Promise<void> {
  const colorCodes = [...new Set(input.colorCodes ?? [])];
  const sizeCodes = [...new Set(input.sizeCodes ?? [])];

  await tx.productColor.deleteMany({ where: { productId } });
  const selectedColors = colorCodes.length
    ? await tx.color.findMany({ where: { code: { in: colorCodes } }, select: { id: true, code: true } })
    : [];
  if (selectedColors.length > 0) {
    await tx.productColor.createMany({ data: selectedColors.map((c) => ({ productId, colorId: c.id })) });
  }

  const [sizes, existingVariants] = await Promise.all([
    sizeCodes.length
      ? tx.size.findMany({ where: { code: { in: sizeCodes }, scope: SizeScope.SHIRT }, select: { id: true, code: true } })
      : Promise.resolve([]),
    tx.productVariant.findMany({
      where: { productId },
      include: { color: true, size: true, _count: { select: { orderItems: true } } },
    }),
  ]);

  const colorIdByCode = new Map(selectedColors.map((c) => [c.code, c.id]));
  const sizeIdByCode = new Map(sizes.map((s) => [s.code, s.id]));
  const stockByCombo = new Map(
    (input.variantStocks ?? []).map((v) => [`${v.colorCode}:${v.sizeCode}`, v.stock === "" ? 0 : Number(v.stock)]),
  );

  const desiredCombos = new Set<string>();
  for (const colorCode of colorCodes) {
    for (const sizeCode of sizeCodes) desiredCombos.add(`${colorCode}:${sizeCode}`);
  }

  for (const combo of desiredCombos) {
    const [colorCode, sizeCode] = combo.split(":");
    const colorId = colorIdByCode.get(colorCode);
    const sizeId = sizeIdByCode.get(sizeCode);
    // A stale/unknown code (option removed elsewhere between load and save) is skipped rather
    // than failing the whole save — the admin can re-pick options and save again.
    if (!colorId || !sizeId) continue;
    const stock = stockByCombo.get(combo) ?? 0;
    await tx.productVariant.upsert({
      where: { productId_colorId_sizeId: { productId, colorId, sizeId } },
      update: { stock, active: true },
      create: { productId, colorId, sizeId, stock, active: true },
    });
  }

  for (const variant of existingVariants) {
    const code = variant.color && variant.size ? `${variant.color.code}:${variant.size.code}` : null;
    if (code && desiredCombos.has(code)) continue;
    if (variant._count.orderItems > 0) {
      if (variant.active) await tx.productVariant.update({ where: { id: variant.id }, data: { active: false } });
    } else {
      await tx.productVariant.delete({ where: { id: variant.id } });
    }
  }
}

/** Replaces a PAINTING product's per-size prices. ProductSize has no downstream OrderItem FK
 * (order items snapshot the price, referencing only the size *code* inside optionsJson), so a
 * plain delete + recreate is safe — nothing to preserve-or-deactivate here. */
async function syncPaintingSizes(
  tx: Prisma.TransactionClient,
  productId: string,
  sizePrices: { sizeCode: string; price: string }[],
): Promise<void> {
  const priced = sizePrices.filter((sp) => {
    const n = Number(sp.price);
    return sp.price.trim() !== "" && Number.isFinite(n) && n >= 0;
  });
  const sizeCodes = priced.map((sp) => sp.sizeCode);
  const sizes = sizeCodes.length
    ? await tx.size.findMany({ where: { code: { in: sizeCodes }, scope: SizeScope.PAINTING }, select: { id: true, code: true } })
    : [];
  const sizeIdByCode = new Map(sizes.map((s) => [s.code, s.id]));

  await tx.productSize.deleteMany({ where: { productId } });
  const data = priced
    .map((sp) => ({ sizeId: sizeIdByCode.get(sp.sizeCode), price: Number(sp.price) }))
    .filter((d): d is { sizeId: string; price: number } => Boolean(d.sizeId));
  if (data.length > 0) {
    await tx.productSize.createMany({ data: data.map((d) => ({ productId, sizeId: d.sizeId, price: d.price })) });
  }
}

/** Replaces a product's ProductImage rows wholesale (sortOrder + isPrimary are fully
 * client-owned state by save time). Returns the storage paths of images that were dropped from
 * the set, so the caller can clean up the underlying objects after the transaction commits. */
async function syncImages(
  tx: Prisma.TransactionClient,
  productId: string,
  existingPaths: string[],
  newImages: ProductFormValues["images"],
): Promise<string[]> {
  const newPathSet = new Set(newImages.map((i) => i.path));
  const removedPaths = existingPaths.filter((p) => !newPathSet.has(p));

  await tx.productImage.deleteMany({ where: { productId } });
  if (newImages.length > 0) {
    const hasPrimary = newImages.some((i) => i.isPrimary);
    await tx.productImage.createMany({
      data: newImages.map((img, idx) => ({
        productId,
        path: img.path,
        alt: img.alt || null,
        isPrimary: hasPrimary ? img.isPrimary : idx === 0,
        sortOrder: img.sortOrder,
      })),
    });
  }
  return removedPaths;
}

/**
 * Create-or-update in one action (mirrors the mockup's single `pfSave`): `input.id` present means
 * update. `type` is accepted from the client only to populate a brand-new product — once a
 * product exists its type is re-read from the DB row and the client's value is ignored, because
 * shirts and paintings have structurally different child rows (variants+colors vs. sized prices)
 * and switching type on an existing product would silently orphan/misinterpret them.
 */
export async function saveProductAction(raw: unknown): Promise<SaveProductResult> {
  const parsed = productFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "INVALID_INPUT", details: parsed.error.issues[0]?.message };
  }
  const input = parsed.data;

  try {
    const admin = await requireRole(AdminRole.ADMIN);
    let removedImagePaths: string[] = [];

    const productId = await prisma.$transaction(async (tx) => {
      const existing = input.id
        ? await tx.product.findUnique({ where: { id: input.id }, include: { images: true } })
        : null;
      if (input.id && !existing) throw new ProductActionError("NOT_FOUND");

      const type = existing ? existing.type : input.type;
      const isShirt = type === ProductType.SHIRT;

      const baseData = {
        type,
        categoryId: input.categoryId,
        nameAr: input.nameAr,
        nameEn: input.nameEn,
        descAr: input.descAr || null,
        descEn: input.descEn || null,
        slug: input.slug,
        featured: input.featured,
        prepAr: input.prepAr || null,
        prepEn: input.prepEn || null,
        displayOrder: input.displayOrder ? Number(input.displayOrder) : 0,
        price: isShirt ? Number(input.price || 0) : null,
        sale: isShirt && input.sale ? Number(input.sale) : null,
        printAvailable: isShirt ? Boolean(input.printAvailable) : false,
        embroideryAvailable: isShirt ? Boolean(input.embroideryAvailable) : false,
        trackStock: isShirt ? Boolean(input.trackStock) : false,
        isOriginal: !isShirt ? Boolean(input.isOriginal) : false,
        artistNoteAr: !isShirt ? input.artistNoteAr || null : null,
        artistNoteEn: !isShirt ? input.artistNoteEn || null : null,
      };

      const product = existing
        ? await tx.product.update({ where: { id: existing.id }, data: baseData })
        : await tx.product.create({ data: baseData });

      if (isShirt) {
        await syncShirtRelations(tx, product.id, input);
      } else {
        await syncPaintingSizes(tx, product.id, input.sizePrices ?? []);
      }

      removedImagePaths = await syncImages(
        tx,
        product.id,
        existing?.images.map((i) => i.path) ?? [],
        input.images,
      );

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: existing ? "product.update" : "product.create",
          targetType: "Product",
          targetId: product.id,
          metadata: { slug: product.slug },
        },
      });

      return product.id;
    });

    await removeImagesBestEffort(removedImagePaths);

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${productId}/edit`);
    updateTag(CATALOG_TAGS.products);
    return { ok: true, id: productId };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "SLUG_TAKEN" };
    }
    return toActionError(err, "SAVE_FAILED");
  }
}
