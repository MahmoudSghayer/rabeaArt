import { describe, expect, it } from "vitest";
import { orderItemSchema, orderPayloadSchema } from "@/lib/orders/schemas";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/validation";
import { getCartSnapshotForSubmit, type CartItem } from "@/lib/cart/store";

const validCustomer = {
  name: "Nour Khatib",
  phone: "+972501234567",
  email: "nour@example.com",
  country: "Palestine",
  city: "Haifa",
  street: "Mountain St 14",
  contact: "whatsapp",
};

const shirtItem = {
  kind: "shirt",
  productId: "prod_shirt_1",
  colorCode: "sand",
  sizeCode: "M",
  method: "print",
  qty: 2,
  notes: "Please wrap nicely",
};

const paintingItem = {
  kind: "painting",
  productId: "prod_painting_1",
  sizeCode: "A4",
  frameCode: "wood",
  qty: 1,
};

const customShirtItem = {
  kind: "custom-shirt",
  options: { color: "ink", size: "M", method: "embroidery", placement: ["front", "sleeve"] },
  qty: 1,
  notes: "Logo on sleeve please",
  files: [
    { bucketPath: "order-uploads/draft-123/abc.jpg", originalName: "logo.jpg", mimeType: "image/jpeg", size: 1024 },
  ],
};

const customPaintingItem = {
  kind: "custom-painting",
  options: { size: "custom", material: "canvas" },
  qty: 1,
  files: [],
};

const customOtherItem = {
  kind: "custom-other",
  options: {},
  qty: 1,
  notes: "I need a custom embroidered tote bag please",
  files: [],
};

function validPayload() {
  return {
    idempotencyKey: crypto.randomUUID(),
    locale: "ar",
    items: [shirtItem, paintingItem, customShirtItem, customPaintingItem, customOtherItem],
    customer: validCustomer,
    notes: "Please call before delivery",
    consentTerms: true,
    consentCustomApproval: true,
  };
}

describe("orderPayloadSchema", () => {
  it("accepts a valid full payload covering every item kind", () => {
    const result = orderPayloadSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("rejects a payload with consentTerms explicitly false", () => {
    const result = orderPayloadSchema.safeParse({ ...validPayload(), consentTerms: false });
    expect(result.success).toBe(false);
  });

  it("rejects a payload missing consentCustomApproval", () => {
    const payload = validPayload() as Record<string, unknown>;
    delete payload.consentCustomApproval;
    const result = orderPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects more than 30 items", () => {
    const result = orderPayloadSchema.safeParse({
      ...validPayload(),
      items: Array.from({ length: 31 }, () => shirtItem),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty items array", () => {
    const result = orderPayloadSchema.safeParse({ ...validPayload(), items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid idempotencyKey", () => {
    const result = orderPayloadSchema.safeParse({ ...validPayload(), idempotencyKey: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

describe("orderItemSchema — price fields are never trusted from the client", () => {
  it("strips client-supplied price-shaped fields instead of rejecting the item", () => {
    const result = orderItemSchema.safeParse({ ...shirtItem, unitPrice: 999, price: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("unitPrice");
      expect(result.data).not.toHaveProperty("price");
    }
  });
});

describe("orderItemSchema — custom-other", () => {
  it("rejects notes shorter than 10 characters", () => {
    const result = orderItemSchema.safeParse({ ...customOtherItem, notes: "short" });
    expect(result.success).toBe(false);
  });

  it("accepts notes at exactly 10 characters", () => {
    const result = orderItemSchema.safeParse({ ...customOtherItem, notes: "1234567890" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing notes field (required for custom-other, unlike other kinds)", () => {
    const item = { ...customOtherItem } as Record<string, unknown>;
    delete item.notes;
    const result = orderItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

describe("orderItemSchema — custom item options", () => {
  it("rejects more than 20 option entries", () => {
    const options = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`key${i}`, "value"]));
    const result = orderItemSchema.safeParse({ ...customPaintingItem, options });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 20 option entries", () => {
    const options = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`key${i}`, "value"]));
    const result = orderItemSchema.safeParse({ ...customPaintingItem, options });
    expect(result.success).toBe(true);
  });

  it("rejects an option value longer than 500 characters", () => {
    const result = orderItemSchema.safeParse({
      ...customPaintingItem,
      options: { note: "x".repeat(501) },
    });
    expect(result.success).toBe(false);
  });

  it("accepts array-valued options (e.g. multi-select placement)", () => {
    const result = orderItemSchema.safeParse(customShirtItem);
    expect(result.success).toBe(true);
  });
});

describe("orderItemSchema — file validation", () => {
  it("rejects a file over MAX_UPLOAD_BYTES", () => {
    const result = orderItemSchema.safeParse({
      ...customShirtItem,
      files: [
        {
          bucketPath: "order-uploads/draft-123/abc.jpg",
          originalName: "logo.jpg",
          mimeType: "image/jpeg",
          size: MAX_UPLOAD_BYTES + 1,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a file exactly at MAX_UPLOAD_BYTES", () => {
    const result = orderItemSchema.safeParse({
      ...customShirtItem,
      files: [
        {
          bucketPath: "order-uploads/draft-123/abc.jpg",
          originalName: "logo.jpg",
          mimeType: "image/jpeg",
          size: MAX_UPLOAD_BYTES,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a bucketPath that doesn't start with 'order-uploads/'", () => {
    const result = orderItemSchema.safeParse({
      ...customShirtItem,
      files: [
        { bucketPath: "some-other-bucket/abc.jpg", originalName: "logo.jpg", mimeType: "image/jpeg", size: 1024 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a disallowed mime type", () => {
    const result = orderItemSchema.safeParse({
      ...customShirtItem,
      files: [
        {
          bucketPath: "order-uploads/draft-123/abc.svg",
          originalName: "logo.svg",
          mimeType: "image/svg+xml",
          size: 1024,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("orderItemSchema — qty bounds", () => {
  it("rejects qty of 0", () => {
    expect(orderItemSchema.safeParse({ ...shirtItem, qty: 0 }).success).toBe(false);
  });

  it("rejects qty over 30", () => {
    expect(orderItemSchema.safeParse({ ...shirtItem, qty: 31 }).success).toBe(false);
  });

  it("accepts qty at the 30 boundary", () => {
    expect(orderItemSchema.safeParse({ ...shirtItem, qty: 30 }).success).toBe(true);
  });
});

describe("getCartSnapshotForSubmit", () => {
  const cartItems: CartItem[] = [
    {
      kind: "shirt",
      key: "k1",
      productId: "prod_shirt_1",
      slug: "dawn-shirt",
      nameAr: "قميص الفجر",
      nameEn: "Dawn Shirt",
      colorCode: "sand",
      sizeCode: "M",
      method: "print",
      qty: 2,
      unitPrice: 120,
      notes: "Please wrap nicely",
    },
    {
      kind: "painting",
      key: "k2",
      productId: "prod_painting_1",
      slug: "rivers",
      nameAr: "بين النهرين",
      nameEn: "Between Two Rivers",
      sizeCode: "A4",
      frameCode: "wood",
      qty: 1,
      unitPrice: 250,
      notes: "",
    },
    {
      kind: "custom-shirt",
      key: "k3",
      labelAr: "قميص مخصص",
      labelEn: "Custom shirt",
      qty: 1,
      unitPrice: null,
      options: { color: "ink", size: "M" },
      notes: "Logo on sleeve",
      files: [
        {
          bucketPath: "order-uploads/draft-123/abc.jpg",
          originalName: "logo.jpg",
          mimeType: "image/jpeg",
          size: 1024,
          previewDataUrl: "data:image/jpeg;base64,AAAA",
        },
      ],
    },
    {
      kind: "custom-painting",
      key: "k4",
      labelAr: "لوحة مخصصة",
      labelEn: "Custom painting",
      qty: 1,
      unitPrice: null,
      options: { size: "custom", material: "canvas" },
      notes: "",
      files: [],
    },
    {
      kind: "custom-other",
      key: "k5",
      labelAr: "طلب خاص آخر",
      labelEn: "Custom request",
      qty: 1,
      unitPrice: null,
      options: {},
      notes: "I need a custom embroidered tote bag please",
      files: [],
    },
  ];

  const snapshot = getCartSnapshotForSubmit(cartItems);

  it("maps every cart item kind to a submittable shape and produces valid schema output", () => {
    expect(snapshot).toHaveLength(5);
    for (const item of snapshot) {
      expect(orderItemSchema.safeParse(item).success).toBe(true);
    }
  });

  it("maps the shirt item without carrying unitPrice/slug/name fields", () => {
    expect(snapshot[0]).toEqual({
      kind: "shirt",
      productId: "prod_shirt_1",
      colorCode: "sand",
      sizeCode: "M",
      method: "print",
      qty: 2,
      notes: "Please wrap nicely",
    });
  });

  it("maps the painting item without carrying unitPrice/slug/name fields", () => {
    expect(snapshot[1]).toEqual({
      kind: "painting",
      productId: "prod_painting_1",
      sizeCode: "A4",
      frameCode: "wood",
      qty: 1,
      notes: "",
    });
  });

  it("strips previewDataUrl from custom item files", () => {
    const customShirtSnapshot = snapshot[2] as { files: Array<Record<string, unknown>> };
    expect(customShirtSnapshot.files).toEqual([
      { bucketPath: "order-uploads/draft-123/abc.jpg", originalName: "logo.jpg", mimeType: "image/jpeg", size: 1024 },
    ]);
    expect(customShirtSnapshot.files[0]).not.toHaveProperty("previewDataUrl");
  });

  it("maps custom-painting and custom-other items without label fields", () => {
    expect(snapshot[3]).toEqual({
      kind: "custom-painting",
      options: { size: "custom", material: "canvas" },
      qty: 1,
      notes: "",
      files: [],
    });
    expect(snapshot[4]).toEqual({
      kind: "custom-other",
      options: {},
      qty: 1,
      notes: "I need a custom embroidered tote bag please",
      files: [],
    });
  });
});
