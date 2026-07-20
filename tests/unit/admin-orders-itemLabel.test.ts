import { describe, expect, it } from "vitest";
import { pickItemLabel } from "@/app/admin/orders/itemLabel";

describe("pickItemLabel — catalog items (snapshot name)", () => {
  it("prefers the snapshot name in the requested locale", () => {
    const item = { snapshotNameAr: "قميص الفجر", snapshotNameEn: "Dawn Shirt", labelAr: null, labelEn: null };
    expect(pickItemLabel(item, "ar")).toBe("قميص الفجر");
    expect(pickItemLabel(item, "en")).toBe("Dawn Shirt");
  });

  it("falls back to the other locale's snapshot name when the preferred one is empty", () => {
    const item = { snapshotNameAr: null, snapshotNameEn: "Dawn Shirt", labelAr: null, labelEn: null };
    expect(pickItemLabel(item, "ar")).toBe("Dawn Shirt");
  });
});

describe("pickItemLabel — custom items (label)", () => {
  it("uses labelAr/labelEn when snapshot names are absent", () => {
    const item = { snapshotNameAr: null, snapshotNameEn: null, labelAr: "قميص مخصص", labelEn: "Custom shirt" };
    expect(pickItemLabel(item, "ar")).toBe("قميص مخصص");
    expect(pickItemLabel(item, "en")).toBe("Custom shirt");
  });

  it("falls back across locale when only one label side is set", () => {
    const item = { snapshotNameAr: null, snapshotNameEn: null, labelAr: null, labelEn: "Custom shirt" };
    expect(pickItemLabel(item, "ar")).toBe("Custom shirt");
  });
});

describe("pickItemLabel — product fallback", () => {
  it("falls back to the live product name when both snapshot and label are empty", () => {
    const item = {
      snapshotNameAr: null,
      snapshotNameEn: null,
      labelAr: null,
      labelEn: null,
      product: { nameAr: "قميص", nameEn: "Shirt" },
    };
    expect(pickItemLabel(item, "en")).toBe("Shirt");
    expect(pickItemLabel(item, "ar")).toBe("قميص");
  });

  it("prefers snapshot/label over the joined product name even when product is present", () => {
    const item = {
      snapshotNameAr: "الاسم وقت الطلب",
      snapshotNameEn: null,
      labelAr: null,
      labelEn: null,
      product: { nameAr: "الاسم الحالي", nameEn: "Current name" },
    };
    expect(pickItemLabel(item, "ar")).toBe("الاسم وقت الطلب");
  });
});

describe("pickItemLabel — never blank", () => {
  it("returns '' rather than throwing when every source is empty", () => {
    expect(pickItemLabel({ snapshotNameAr: null, snapshotNameEn: null, labelAr: null, labelEn: null }, "ar")).toBe(
      "",
    );
  });

  it("treats an empty string the same as null (falls through to fallback)", () => {
    const item = { snapshotNameAr: "", snapshotNameEn: "Dawn Shirt", labelAr: null, labelEn: null };
    expect(pickItemLabel(item, "ar")).toBe("Dawn Shirt");
  });
});
