import { z } from "zod";
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES } from "@/lib/storage/validation";

/**
 * Shared client/server validation for the order-submission payload (no `server-only` import —
 * the storefront cart form uses these same schemas for client-side pre-validation before the
 * `/api/orders` route re-validates them authoritatively).
 *
 * Deliberately does NOT accept any price field from the client: catalog items carry only the
 * selection (product/color/size/frame/method), never a price, and `submitOrder` (see
 * src/lib/orders/submit.ts) re-derives every price from a fresh DB read inside the transaction.
 * A stray `unitPrice`/`price` key on an incoming payload is simply stripped by zod's default
 * "strip unknown keys" object behavior rather than rejected — see order-schemas.test.ts.
 */

const QTY_MIN = 1;
const QTY_MAX = 30;
const NOTES_MAX = 1000;
/** Generic per-option string length cap — long enough for a free-text placement/material choice, short enough to bound abuse. */
const OPTION_VALUE_MAX = 500;
/** Sanity cap on multi-value options (e.g. placement checkboxes) — no real UI offers anywhere near this many choices. */
const OPTION_ARRAY_MAX = 50;
/** Sanity cap on the *number* of option entries a custom item can carry. */
const OPTION_ENTRIES_MAX = 20;

const qtySchema = z.int().min(QTY_MIN).max(QTY_MAX);

const optionValueSchema = z.union([
  z.string().max(OPTION_VALUE_MAX),
  z.array(z.string().max(OPTION_VALUE_MAX)).max(OPTION_ARRAY_MAX),
]);

/**
 * Custom-order option bags are free-form by nature (placement, material, dimensions, style, …
 * differ per custom kind and evolve with the wizard UI), so keys are validated loosely — just
 * bounded in count/length — rather than against a fixed shape.
 */
const customOptionsSchema = z
  .record(z.string().min(1).max(100), optionValueSchema)
  .refine((val) => Object.keys(val).length <= OPTION_ENTRIES_MAX, {
    message: `Too many option entries (max ${OPTION_ENTRIES_MAX})`,
  });

const customFileSchema = z.object({
  // See src/lib/storage/uploads.ts's CANONICAL bucketPath FORMAT comment: this is the full
  // "order-uploads/{draftId}/{uuid}.{ext}" form, not the bucket-relative upload-sign response.
  bucketPath: z.string().min(1).max(500).startsWith("order-uploads/"),
  originalName: z.string().min(1).max(200),
  // Spread to a mutable array: z.enum's typing wants a non-readonly tuple even though the
  // allowlist itself (see lib/storage/validation) is intentionally declared `as const`.
  mimeType: z.enum([...ALLOWED_UPLOAD_MIME]),
  size: z.int().min(1).max(MAX_UPLOAD_BYTES),
});

const shirtOrderItemSchema = z.object({
  kind: z.literal("shirt"),
  productId: z.string().min(1).max(64),
  colorCode: z.string().min(1).max(64),
  sizeCode: z.string().min(1).max(64),
  method: z.enum(["print", "embroidery"]).nullable().optional(),
  qty: qtySchema,
  notes: z.string().max(NOTES_MAX).optional(),
});

const paintingOrderItemSchema = z.object({
  kind: z.literal("painting"),
  productId: z.string().min(1).max(64),
  sizeCode: z.string().min(1).max(64),
  frameCode: z.string().min(1).max(64),
  qty: qtySchema,
  notes: z.string().max(NOTES_MAX).optional(),
});

const customItemSharedShape = {
  options: customOptionsSchema,
  qty: qtySchema,
  files: z.array(customFileSchema).max(MAX_UPLOAD_FILES),
};

const customShirtOrderItemSchema = z.object({
  kind: z.literal("custom-shirt"),
  notes: z.string().max(NOTES_MAX).optional(),
  ...customItemSharedShape,
});

const customPaintingOrderItemSchema = z.object({
  kind: z.literal("custom-painting"),
  notes: z.string().max(NOTES_MAX).optional(),
  ...customItemSharedShape,
});

/**
 * "custom-other" is the catch-all bucket for anything that doesn't fit the shirt/painting
 * wizards, so a free-text description is the only thing standing between the studio and a
 * useless request — 10 characters is a low bar, just enough to reject an accidental empty/junk
 * submit rather than to demand a full brief.
 */
const customOtherOrderItemSchema = z.object({
  kind: z.literal("custom-other"),
  notes: z.string().min(10, "Please describe what you'd like — at least 10 characters.").max(NOTES_MAX),
  ...customItemSharedShape,
});

export const orderItemSchema = z.discriminatedUnion("kind", [
  shirtOrderItemSchema,
  paintingOrderItemSchema,
  customShirtOrderItemSchema,
  customPaintingOrderItemSchema,
  customOtherOrderItemSchema,
]);

export type OrderItemInput = z.infer<typeof orderItemSchema>;

const addressFieldSchema = z.string().max(200).optional();
const contactStringSchema = z.string().min(8).max(32).regex(/^[\d+\-\s()]{8,}$/, "Enter a valid phone number.");

export const customerSchema = z.object({
  name: z.string().min(2).max(200),
  phone: contactStringSchema,
  whatsapp: contactStringSchema.optional(),
  email: z.email(),
  country: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  street: z.string().min(1).max(300),
  building: addressFieldSchema,
  apt: addressFieldSchema,
  postal: z.string().max(20).optional(),
  instructions: z.string().max(1000).optional(),
  contact: z.enum(["phone", "whatsapp", "email"]),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const orderPayloadSchema = z.object({
  idempotencyKey: z.uuid(),
  locale: z.enum(["ar", "en"]),
  items: z.array(orderItemSchema).min(1).max(QTY_MAX),
  customer: customerSchema,
  notes: z.string().max(2000).optional(),
  // Literal `true` rather than `z.boolean()` — an order can't be created without both consents,
  // so "false"/missing must fail validation, not just be recorded as false.
  consentTerms: z.literal(true),
  consentCustomApproval: z.literal(true),
});

export type OrderPayload = z.infer<typeof orderPayloadSchema>;
