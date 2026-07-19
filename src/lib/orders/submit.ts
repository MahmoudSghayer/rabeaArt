import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { Customer } from "@/generated/prisma/client";
import { ContactMethod, ItemKind, OrderStatus, PaymentStatus, ProductType } from "@/generated/prisma/enums";
import { cartTotals, estTotalForOrder, paintingUnitPrice, shirtUnitPrice } from "@/lib/pricing";
import { decideCustomerMatch, normalizeEmail, normalizePhone } from "@/lib/customer-matching";
import { formatOrderRef } from "@/lib/orders/ref";
import type { CustomerInput, OrderItemInput, OrderPayload } from "@/lib/orders/schemas";

/**
 * The order-submission transaction. Everything the storefront cart form needs is validated
 * client/server-shared by `orderPayloadSchema` (see schemas.ts) *before* this runs — this module
 * only owns what zod can't: authoritative, fresh-from-the-DB pricing and the atomic write.
 *
 * No online payment exists in this app (see prisma/schema.prisma's `PaymentStatus` doc / the
 * project brief): submitting an order never charges anyone, so the only correctness bar here is
 * "the studio ends up with an accurate, de-duplicated order to review" — not payment safety.
 *
 * Relies on the Postgres sequence `order_ref_seq` (`SELECT nextval('order_ref_seq')` below),
 * created by the "Custom: human-readable order reference sequence" block in
 * prisma/migrations/0_init/migration.sql.
 */

export type SubmitErrorCode =
  /** Catalog item's `productId` doesn't resolve to a non-archived product of the right type. */
  | "PRODUCT_NOT_FOUND"
  /** Selected color/size/method (shirt) or size/frame (painting) isn't offered by the product. */
  | "INVALID_OPTION"
  /** A "custom-other" item was submitted while Settings.customOtherEnabled is false. */
  | "CUSTOM_OTHER_DISABLED";

/** Thrown for business-rule failures discovered only once we re-read the DB — the route handler
 * maps this to an HTTP 422 with just `{ code }` (see src/app/api/orders/route.ts). */
export class SubmitError extends Error {
  readonly code: SubmitErrorCode;

  constructor(code: SubmitErrorCode, message?: string) {
    super(message ?? code);
    this.name = "SubmitError";
    this.code = code;
  }
}

export type SubmitResult = {
  ref: string;
  /** null means "priced after review" (see estTotalForOrder in @/lib/pricing). */
  estTotal: number | null;
  /** Count of order ITEMS (not qty) with manual (null) pricing. */
  manualCount: number;
};

/** Tiny data map, not UI copy — the generic label shown for a custom item in the admin table
 * before a human writes something more specific. Deliberately hardcoded here rather than pulled
 * from next-intl messages: this is what gets snapshotted onto the OrderItem row forever, not a
 * live-translated UI string. */
const CUSTOM_ITEM_LABELS: Record<"custom-shirt" | "custom-painting" | "custom-other", { ar: string; en: string }> = {
  "custom-shirt": { ar: "قميص مخصص", en: "Custom shirt" },
  "custom-painting": { ar: "لوحة مخصصة", en: "Custom painting" },
  "custom-other": { ar: "طلب خاص آخر", en: "Custom request" },
};

const ITEM_KIND_MAP: Record<OrderItemInput["kind"], ItemKind> = {
  shirt: ItemKind.SHIRT,
  painting: ItemKind.PAINTING,
  "custom-shirt": ItemKind.CUSTOM_SHIRT,
  "custom-painting": ItemKind.CUSTOM_PAINTING,
  "custom-other": ItemKind.CUSTOM_OTHER,
};

const CONTACT_METHOD_MAP: Record<CustomerInput["contact"], ContactMethod> = {
  phone: ContactMethod.PHONE,
  whatsapp: ContactMethod.WHATSAPP,
  email: ContactMethod.EMAIL,
};

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

type PricedItemFile = { bucketPath: string; originalName: string; mimeType: string; size: number };

type PricedItem = {
  unitPrice: number | null;
  qty: number;
  itemData: Omit<Prisma.OrderItemCreateManyInput, "id" | "orderId">;
  files: PricedItemFile[];
};

async function priceShirtItem(item: Extract<OrderItemInput, { kind: "shirt" }>): Promise<PricedItem> {
  const product = await prisma.product.findUnique({
    where: { id: item.productId },
    include: {
      colors: { include: { color: true } },
      variants: { include: { color: true, size: true } },
    },
  });

  if (!product || product.archived || product.type !== ProductType.SHIRT || product.price === null) {
    throw new SubmitError("PRODUCT_NOT_FOUND");
  }
  if (!product.colors.some((pc) => pc.color.code === item.colorCode)) {
    throw new SubmitError("INVALID_OPTION");
  }
  if (item.method === "print" && !product.printAvailable) throw new SubmitError("INVALID_OPTION");
  if (item.method === "embroidery" && !product.embroideryAvailable) throw new SubmitError("INVALID_OPTION");

  // A colour/size pairing is only orderable if it has a ProductVariant row — that's how the
  // catalog defines "this combination exists" (see src/lib/catalog/queries.ts).
  const variant = product.variants.find((v) => v.color?.code === item.colorCode && v.size?.code === item.sizeCode);
  if (!variant) throw new SubmitError("INVALID_OPTION");

  const unitPrice = shirtUnitPrice({ price: Number(product.price), sale: decimalToNumber(product.sale) });
  // Stock is informational at submit time — never blocks the order and never decrements here;
  // it only moves when an admin transitions the order into ACCEPTED (see lib/orders/transitions.ts).
  const stockWarning = product.trackStock && variant.stock < item.qty;

  return {
    unitPrice,
    qty: item.qty,
    itemData: {
      kind: ItemKind.SHIRT,
      productId: product.id,
      variantId: variant.id,
      labelAr: null,
      labelEn: null,
      unitPrice,
      optionsJson: { colorCode: item.colorCode, sizeCode: item.sizeCode, method: item.method ?? null } as Prisma.InputJsonValue,
      notes: item.notes ?? null,
      snapshotNameAr: product.nameAr,
      snapshotNameEn: product.nameEn,
      stockWarning,
      qty: item.qty,
    },
    files: [],
  };
}

async function pricePaintingItem(item: Extract<OrderItemInput, { kind: "painting" }>): Promise<PricedItem> {
  const product = await prisma.product.findUnique({
    where: { id: item.productId },
    include: { sizes: { include: { size: true } } },
  });

  if (!product || product.archived || product.type !== ProductType.PAINTING) {
    throw new SubmitError("PRODUCT_NOT_FOUND");
  }
  const productSize = product.sizes.find((ps) => ps.size.code === item.sizeCode);
  if (!productSize) throw new SubmitError("INVALID_OPTION");

  // Frames are a global option list (not product-specific), so they're looked up independently
  // of the product row — see the Frame model and CatalogFrameOption in lib/catalog.
  const frame = await prisma.frame.findUnique({ where: { code: item.frameCode } });
  if (!frame || !frame.active) throw new SubmitError("INVALID_OPTION");

  const unitPrice = paintingUnitPrice(Number(productSize.price), Number(frame.add));

  return {
    unitPrice,
    qty: item.qty,
    itemData: {
      kind: ItemKind.PAINTING,
      productId: product.id,
      variantId: null,
      labelAr: null,
      labelEn: null,
      unitPrice,
      optionsJson: { sizeCode: item.sizeCode, frameCode: item.frameCode } as Prisma.InputJsonValue,
      notes: item.notes ?? null,
      snapshotNameAr: product.nameAr,
      snapshotNameEn: product.nameEn,
      stockWarning: false,
      qty: item.qty,
    },
    files: [],
  };
}

async function priceCustomItem(
  item: Extract<OrderItemInput, { kind: "custom-shirt" | "custom-painting" | "custom-other" }>,
): Promise<PricedItem> {
  if (item.kind === "custom-other") {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    // Settings row is a singleton seeded on first admin write; a missing row means "never
    // configured yet", which defaults open (matches DEFAULT_SETTINGS in lib/catalog/queries.ts).
    const customOtherEnabled = settings?.customOtherEnabled ?? true;
    if (!customOtherEnabled) throw new SubmitError("CUSTOM_OTHER_DISABLED");
  }

  const label = CUSTOM_ITEM_LABELS[item.kind];
  return {
    unitPrice: null,
    qty: item.qty,
    itemData: {
      kind: ITEM_KIND_MAP[item.kind],
      productId: null,
      variantId: null,
      labelAr: label.ar,
      labelEn: label.en,
      unitPrice: null,
      optionsJson: item.options as Prisma.InputJsonValue,
      notes: item.notes ?? null,
      snapshotNameAr: null,
      snapshotNameEn: null,
      stockWarning: false,
      qty: item.qty,
    },
    files: item.files.map((f) => ({
      bucketPath: f.bucketPath,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
    })),
  };
}

function priceOrderItem(item: OrderItemInput): Promise<PricedItem> {
  if (item.kind === "shirt") return priceShirtItem(item);
  if (item.kind === "painting") return pricePaintingItem(item);
  return priceCustomItem(item);
}

/** Builds the patch of currently-blank Customer fields to fill in from a matched order's
 * customer data — an existing customer's non-empty fields are never overwritten (see
 * decideCustomerMatch's doc comment on why matches don't silently merge everything). */
function blankFieldsPatch(
  existing: Customer,
  incoming: CustomerInput,
  phoneNormalized: string | null,
  emailNormalized: string | null,
  preferredContact: ContactMethod,
): Prisma.CustomerUpdateInput {
  const patch: Prisma.CustomerUpdateInput = {};
  if (!existing.phone && incoming.phone) {
    patch.phone = incoming.phone;
    patch.phoneNormalized = phoneNormalized;
  }
  if (!existing.whatsapp && incoming.whatsapp) patch.whatsapp = incoming.whatsapp;
  if (!existing.email && incoming.email) {
    patch.email = incoming.email;
    patch.emailNormalized = emailNormalized;
  }
  if (!existing.country && incoming.country) patch.country = incoming.country;
  if (!existing.city && incoming.city) patch.city = incoming.city;
  if (!existing.street && incoming.street) patch.street = incoming.street;
  if (!existing.building && incoming.building) patch.building = incoming.building;
  if (!existing.apt && incoming.apt) patch.apt = incoming.apt;
  if (!existing.postal && incoming.postal) patch.postal = incoming.postal;
  if (!existing.instructions && incoming.instructions) patch.instructions = incoming.instructions;
  if (!existing.preferredContact) patch.preferredContact = preferredContact;
  return patch;
}

/**
 * Finds/creates the Customer for this order and returns its id. Runs inside the caller's
 * transaction (not as a separate pre-step) so a concurrent duplicate submission can never leave
 * an orphaned Customer row behind — see the "decisions worth review" note in the final report
 * about why this reads as one atomic unit with order creation rather than as a step beforehand.
 */
async function resolveCustomer(
  tx: Prisma.TransactionClient,
  customer: CustomerInput,
  phoneNormalized: string | null,
  emailNormalized: string | null,
): Promise<string> {
  const candidates =
    phoneNormalized || emailNormalized
      ? await tx.customer.findMany({
          where: {
            OR: [
              ...(phoneNormalized ? [{ phoneNormalized }] : []),
              ...(emailNormalized ? [{ emailNormalized }] : []),
            ],
          },
        })
      : [];

  const decision = decideCustomerMatch(
    { phoneNormalized, emailNormalized },
    candidates.map((c) => ({ id: c.id, phoneNormalized: c.phoneNormalized, emailNormalized: c.emailNormalized })),
  );
  const preferredContact = CONTACT_METHOD_MAP[customer.contact];

  if (decision.kind === "match") {
    const existing = candidates.find((c) => c.id === decision.id);
    if (!existing) throw new Error("resolveCustomer: matched id missing from its own candidate list");
    const patch = blankFieldsPatch(existing, customer, phoneNormalized, emailNormalized, preferredContact);
    if (Object.keys(patch).length > 0) {
      await tx.customer.update({ where: { id: existing.id }, data: patch });
    }
    return existing.id;
  }

  // "conflict": phone and email each matched a *different* existing customer. We never guess
  // which one is right — create a new customer and leave a machine-readable trail in `notes` so
  // an admin can review and merge manually. There's no AuditLog row for this: AuditLog.actorId
  // is a required AdminUser FK, and this happens on the public storefront with no admin actor.
  const created = await tx.customer.create({
    data: {
      name: customer.name,
      phone: customer.phone,
      phoneNormalized,
      whatsapp: customer.whatsapp ?? null,
      email: customer.email,
      emailNormalized,
      country: customer.country,
      city: customer.city,
      street: customer.street,
      building: customer.building ?? null,
      apt: customer.apt ?? null,
      postal: customer.postal ?? null,
      instructions: customer.instructions ?? null,
      preferredContact,
      notes:
        decision.kind === "conflict"
          ? `[system] possible duplicate of ${decision.phoneMatchId},${decision.emailMatchId}`
          : null,
    },
  });
  return created.id;
}

/** Re-fetches an order by idempotencyKey and reshapes it into the same response contract
 * `submitOrder` returns for a fresh submit — used both for the idempotency fast-path and for the
 * P2002 collision handler, so a double-click on "submit" always gets the identical response. */
async function findExistingByIdempotencyKey(idempotencyKey: string): Promise<SubmitResult | null> {
  const order = await prisma.order.findUnique({
    where: { idempotencyKey },
    include: { items: { select: { unitPrice: true } } },
  });
  if (!order) return null;
  return {
    ref: order.ref,
    estTotal: decimalToNumber(order.estTotal),
    manualCount: order.items.filter((i) => i.unitPrice === null).length,
  };
}

export async function submitOrder(payload: OrderPayload): Promise<SubmitResult> {
  // Fast path: a double-click / retry with the same idempotencyKey skips repricing and customer
  // work entirely. The transaction's unique-constraint catch below is the authoritative guard
  // against the race where two requests both miss this check (see resolveCustomer's doc comment).
  const existing = await findExistingByIdempotencyKey(payload.idempotencyKey);
  if (existing) return existing;

  const pricedItems = await Promise.all(payload.items.map((item) => priceOrderItem(item)));
  const totals = cartTotals(pricedItems.map((p) => ({ unitPrice: p.unitPrice, qty: p.qty })));
  const estTotal = estTotalForOrder(totals);

  const phoneNormalized = normalizePhone(payload.customer.phone);
  const emailNormalized = normalizeEmail(payload.customer.email);

  try {
    const ref = await prisma.$transaction(async (tx) => {
      const customerId = await resolveCustomer(tx, payload.customer, phoneNormalized, emailNormalized);

      const seqRows = await tx.$queryRaw<{ nextval: bigint | number | string }[]>`SELECT nextval('order_ref_seq') AS nextval`;
      const orderRef = formatOrderRef(Number(seqRows[0].nextval));

      const order = await tx.order.create({
        data: {
          ref: orderRef,
          status: OrderStatus.NEW,
          pay: PaymentStatus.NOT_REQUIRED,
          estTotal,
          customerId,
          contactMethod: CONTACT_METHOD_MAP[payload.customer.contact],
          notes: payload.notes ?? null,
          consentTerms: payload.consentTerms,
          consentCustomApproval: payload.consentCustomApproval,
          idempotencyKey: payload.idempotencyKey,
          locale: payload.locale,
        },
      });

      const itemIds = pricedItems.map(() => crypto.randomUUID());
      const itemRecords: Prisma.OrderItemCreateManyInput[] = pricedItems.map((p, idx) => ({
        id: itemIds[idx],
        orderId: order.id,
        ...p.itemData,
      }));
      await tx.orderItem.createMany({ data: itemRecords });

      // Files are attached to the specific custom OrderItem they were uploaded for. bucketPath
      // is stored exactly as staged (see src/lib/storage/uploads.ts) — files are NOT moved
      // between storage prefixes on submit. Once an OrderFile row exists for a staged object,
      // the cleanup cron (owned elsewhere) must treat it as permanent, not orphaned.
      const fileRecords: Prisma.OrderFileCreateManyInput[] = pricedItems.flatMap((p, idx) =>
        p.files.map((f) => ({ id: crypto.randomUUID(), orderId: order.id, orderItemId: itemIds[idx], ...f })),
      );
      if (fileRecords.length > 0) {
        await tx.orderFile.createMany({ data: fileRecords });
      }

      await tx.orderStatusHistory.create({
        data: { orderId: order.id, status: OrderStatus.NEW, note: null, byAdminId: null },
      });

      return orderRef;
    });

    return { ref, estTotal, manualCount: totals.manual };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await findExistingByIdempotencyKey(payload.idempotencyKey);
      if (raced) return raced;
    }
    throw err;
  }
}
