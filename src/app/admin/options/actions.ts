"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AdminRole, SizeScope } from "@/generated/prisma/enums";
import { requireRole, AuthError } from "@/lib/auth/requireRole";

/**
 * Options-page mutations. Same shape as the rest of the admin (see
 * src/app/admin/orders/[id]/actions.ts): `requireRole` first (ADMIN — catalog/options writes are
 * admin-only per the project plan), the mutation + its `AuditLog` row in one `$transaction`, a
 * typed `{ ok, error? }` return, `revalidatePath("/admin/options")` on every success.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

class OptionsActionError extends Error {
  constructor(public code: "NOT_FOUND" | "DUPLICATE" | "PROTECTED") {
    super(code);
    this.name = "OptionsActionError";
  }
}

function toActionError(err: unknown, fallback: string): ActionResult {
  if (err instanceof AuthError) return { ok: false, error: "FORBIDDEN" };
  if (err instanceof OptionsActionError) return { ok: false, error: err.code };
  console.error(fallback, err);
  return { ok: false, error: fallback };
}

/**
 * Uppercase, alphanumeric-only size code (e.g. "3xl " → "3XL", "a2" → "A2"). Stripped down to
 * `[A-Z0-9]` rather than just whitespace: the product-form's variant-matrix sync
 * (src/app/admin/products/actions.ts, `syncShirtRelations`) joins colour+size codes with a `:`
 * to key its combo map, so a code containing `:` (or any other punctuation) would corrupt that
 * parsing — simplest fix is to never let one exist.
 */
const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .refine((v) => v.length > 0, "Code must contain at least one letter or digit.");

const hexSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Enter a hex colour like #B7472A.");

function slugFromLabel(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

async function uniqueCode(
  finder: (code: string) => Promise<unknown>,
  base: string,
): Promise<string> {
  let candidate = base;
  let n = 2;
  while (await finder(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// Sizes (shirt + painting share the same Size model, scoped)
// ---------------------------------------------------------------------------

async function addSize(scope: SizeScope, rawCode: string): Promise<ActionResult> {
  const parsed = codeSchema.safeParse(rawCode);
  if (!parsed.success) return { ok: false, error: "INVALID_CODE" };
  const code = parsed.data;

  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const existing = await tx.size.findUnique({ where: { scope_code: { scope, code } } });
      if (existing) throw new OptionsActionError("DUPLICATE");
      const agg = await tx.size.aggregate({ where: { scope }, _max: { sortOrder: true } });
      await tx.size.create({
        data: { scope, code, labelAr: code, labelEn: code, sortOrder: (agg._max.sortOrder ?? -1) + 1, active: true },
      });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "options.size.add", targetType: "Size", targetId: null, metadata: { scope, code } },
      });
    });
    revalidatePath("/admin/options");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "SIZE_ADD_FAILED");
  }
}

export async function addShirtSizeAction(code: string): Promise<ActionResult> {
  return addSize(SizeScope.SHIRT, code);
}

export async function addPaintingSizeAction(code: string): Promise<ActionResult> {
  return addSize(SizeScope.PAINTING, code);
}

export async function toggleSizeActiveAction(sizeId: string, active: boolean): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const size = await tx.size.findUnique({ where: { id: sizeId } });
      if (!size) throw new OptionsActionError("NOT_FOUND");
      await tx.size.update({ where: { id: sizeId }, data: { active } });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "options.size.toggle", targetType: "Size", targetId: sizeId, metadata: { active } },
      });
    });
    revalidatePath("/admin/options");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "SIZE_TOGGLE_FAILED");
  }
}

async function sizeInUse(tx: Prisma.TransactionClient, sizeId: string): Promise<boolean> {
  const [variantCount, productSizeCount] = await Promise.all([
    tx.productVariant.count({ where: { sizeId } }),
    tx.productSize.count({ where: { sizeId } }),
  ]);
  return variantCount + productSizeCount > 0;
}

/** Removes a size if nothing references it (ProductVariant/ProductSize); otherwise deactivates
 * it. The PAINTING "custom" row is never removable (manual-pricing sentinel the order flow
 * depends on) — the UI hides its remove control, and this re-checks server-side regardless. */
export async function removeSizeAction(sizeId: string): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const size = await tx.size.findUnique({ where: { id: sizeId } });
      if (!size) throw new OptionsActionError("NOT_FOUND");
      if (size.scope === SizeScope.PAINTING && size.code === "custom") throw new OptionsActionError("PROTECTED");

      const inUse = await sizeInUse(tx, sizeId);
      if (inUse) {
        await tx.size.update({ where: { id: sizeId }, data: { active: false } });
      } else {
        await tx.size.delete({ where: { id: sizeId } });
      }
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: inUse ? "options.size.deactivate" : "options.size.remove",
          targetType: "Size",
          targetId: sizeId,
          metadata: { code: size.code, scope: size.scope },
        },
      });
    });
    revalidatePath("/admin/options");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "SIZE_REMOVE_FAILED");
  }
}

// ---------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------

export async function addFrameAction(labelAr: string, labelEn: string): Promise<ActionResult> {
  const ar = labelAr.trim();
  const en = labelEn.trim();
  if (!ar || !en) return { ok: false, error: "INVALID_LABEL" };

  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const code = await uniqueCode((c) => tx.frame.findUnique({ where: { code: c } }), slugFromLabel(en));
      const agg = await tx.frame.aggregate({ _max: { sortOrder: true } });
      await tx.frame.create({
        data: { code, labelAr: ar, labelEn: en, add: 0, active: true, sortOrder: (agg._max.sortOrder ?? -1) + 1 },
      });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "options.frame.add", targetType: "Frame", targetId: null, metadata: { code } },
      });
    });
    revalidatePath("/admin/options");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "FRAME_ADD_FAILED");
  }
}

export async function toggleFrameActiveAction(frameId: string, active: boolean): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const frame = await tx.frame.findUnique({ where: { id: frameId } });
      if (!frame) throw new OptionsActionError("NOT_FOUND");
      await tx.frame.update({ where: { id: frameId }, data: { active } });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "options.frame.toggle", targetType: "Frame", targetId: frameId, metadata: { active } },
      });
    });
    revalidatePath("/admin/options");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "FRAME_TOGGLE_FAILED");
  }
}

const addPriceSchema = z.number().finite().min(0).max(100_000);

export async function updateFrameAddPriceAction(frameId: string, add: number): Promise<ActionResult> {
  const parsed = addPriceSchema.safeParse(add);
  if (!parsed.success) return { ok: false, error: "INVALID_PRICE" };

  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const frame = await tx.frame.findUnique({ where: { id: frameId } });
      if (!frame) throw new OptionsActionError("NOT_FOUND");
      await tx.frame.update({ where: { id: frameId }, data: { add: parsed.data } });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "options.frame.priceUpdate",
          targetType: "Frame",
          targetId: frameId,
          metadata: { add: parsed.data },
        },
      });
    });
    revalidatePath("/admin/options");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "FRAME_PRICE_UPDATE_FAILED");
  }
}

/**
 * Frames have no FK from OrderItem — `frameCode` is stored inside `OrderItem.optionsJson`, a
 * free-form JSON blob, because frames are a global option list (see Frame model's doc comment in
 * schema.prisma), not a product-specific relation. "Unused" is therefore checked with a Postgres
 * JSON-path filter rather than a plain relation count; if that query ever fails for any reason,
 * this fails toward "in use" (deactivate, not delete) rather than risking silent data loss.
 */
async function frameInUse(tx: Prisma.TransactionClient, code: string): Promise<boolean> {
  try {
    const count = await tx.orderItem.count({ where: { optionsJson: { path: ["frameCode"], equals: code } } });
    return count > 0;
  } catch (err) {
    console.error("options/actions: frame usage check failed, defaulting to in-use", err);
    return true;
  }
}

export async function removeFrameAction(frameId: string): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const frame = await tx.frame.findUnique({ where: { id: frameId } });
      if (!frame) throw new OptionsActionError("NOT_FOUND");

      const inUse = await frameInUse(tx, frame.code);
      if (inUse) {
        await tx.frame.update({ where: { id: frameId }, data: { active: false } });
      } else {
        await tx.frame.delete({ where: { id: frameId } });
      }
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: inUse ? "options.frame.deactivate" : "options.frame.remove",
          targetType: "Frame",
          targetId: frameId,
          metadata: { code: frame.code },
        },
      });
    });
    revalidatePath("/admin/options");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "FRAME_REMOVE_FAILED");
  }
}

// ---------------------------------------------------------------------------
// Colors (add + toggle only — no inline edit/remove per the plan)
// ---------------------------------------------------------------------------

export async function addColorAction(nameAr: string, nameEn: string, hex: string): Promise<ActionResult> {
  const ar = nameAr.trim();
  const en = nameEn.trim();
  const hexParsed = hexSchema.safeParse(hex);
  if (!ar || !en || !hexParsed.success) return { ok: false, error: "INVALID_INPUT" };

  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const code = await uniqueCode((c) => tx.color.findUnique({ where: { code: c } }), slugFromLabel(en));
      const agg = await tx.color.aggregate({ _max: { sortOrder: true } });
      await tx.color.create({
        data: {
          code,
          nameAr: ar,
          nameEn: en,
          hex: hexParsed.data.toUpperCase(),
          active: true,
          sortOrder: (agg._max.sortOrder ?? -1) + 1,
        },
      });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "options.color.add", targetType: "Color", targetId: null, metadata: { code } },
      });
    });
    revalidatePath("/admin/options");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "COLOR_ADD_FAILED");
  }
}

export async function toggleColorActiveAction(colorId: string, active: boolean): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const color = await tx.color.findUnique({ where: { id: colorId } });
      if (!color) throw new OptionsActionError("NOT_FOUND");
      await tx.color.update({ where: { id: colorId }, data: { active } });
      await tx.auditLog.create({
        data: { actorId: admin.id, action: "options.color.toggle", targetType: "Color", targetId: colorId, metadata: { active } },
      });
    });
    revalidatePath("/admin/options");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "COLOR_TOGGLE_FAILED");
  }
}

// ---------------------------------------------------------------------------
// Materials + ProductionMethods (toggle-active only this pass — no add UI, per the plan)
// ---------------------------------------------------------------------------

export async function toggleMaterialActiveAction(materialId: string, active: boolean): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const material = await tx.material.findUnique({ where: { id: materialId } });
      if (!material) throw new OptionsActionError("NOT_FOUND");
      await tx.material.update({ where: { id: materialId }, data: { active } });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "options.material.toggle",
          targetType: "Material",
          targetId: materialId,
          metadata: { active },
        },
      });
    });
    revalidatePath("/admin/options");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "MATERIAL_TOGGLE_FAILED");
  }
}

export async function toggleProductionMethodActiveAction(methodId: string, active: boolean): Promise<ActionResult> {
  try {
    const admin = await requireRole(AdminRole.ADMIN);
    await prisma.$transaction(async (tx) => {
      const method = await tx.productionMethod.findUnique({ where: { id: methodId } });
      if (!method) throw new OptionsActionError("NOT_FOUND");
      await tx.productionMethod.update({ where: { id: methodId }, data: { active } });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "options.productionMethod.toggle",
          targetType: "ProductionMethod",
          targetId: methodId,
          metadata: { active },
        },
      });
    });
    revalidatePath("/admin/options");
    return { ok: true };
  } catch (err) {
    return toActionError(err, "METHOD_TOGGLE_FAILED");
  }
}
