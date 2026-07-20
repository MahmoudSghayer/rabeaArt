import { describe, expect, it } from "vitest";
import {
  artKeyForId,
  formatBytes,
  formatDate,
  formatDateTime,
  initialOf,
  formatMoney,
  phoneDigits,
} from "@/components/admin/format";
import { ARTS } from "@/components/storefront/art";

describe("formatMoney", () => {
  it("renders ₪ with Latin-digit thousands separators", () => {
    expect(formatMoney(1234, "N/A")).toBe("₪1,234");
  });

  it("renders 0 as ₪0, not the N/A label", () => {
    expect(formatMoney(0, "N/A")).toBe("₪0");
  });

  it("returns the naLabel for null", () => {
    expect(formatMoney(null, "Priced after review")).toBe("Priced after review");
  });
});

describe("formatDate", () => {
  it("accepts a Date or an ISO string interchangeably", () => {
    const iso = "2026-07-12T10:00:00.000Z";
    expect(formatDate(iso, "en")).toBe(formatDate(new Date(iso), "en"));
  });

  it("renders Latin numerals for both locales (no Arabic-Indic digits)", () => {
    const s = formatDate("2026-07-12T10:00:00.000Z", "ar");
    expect(s).not.toMatch(/[٠-٩]/);
    expect(s).toMatch(/12/);
  });
});

describe("formatDateTime", () => {
  it("includes hour and minute in addition to the date", () => {
    const s = formatDateTime("2026-07-12T14:30:00.000Z", "en");
    // en-GB 24h formatting — assert a plausible time pattern is present.
    expect(s).toMatch(/\d{1,2}:\d{2}/);
  });

  it("accepts a Date instance directly", () => {
    expect(() => formatDateTime(new Date(), "ar")).not.toThrow();
  });
});

describe("initialOf", () => {
  it("uppercases a Latin first letter", () => {
    expect(initialOf("nour")).toBe("N");
  });

  it("keeps an Arabic first letter as-is (no case concept)", () => {
    expect(initialOf("ربيع")).toBe("ر");
  });

  it("skips leading whitespace", () => {
    expect(initialOf("   zed")).toBe("Z");
  });

  it("returns '?' for an empty/whitespace-only string", () => {
    expect(initialOf("")).toBe("?");
    expect(initialOf("   ")).toBe("?");
  });
});

describe("phoneDigits", () => {
  it("strips a leading + and any spacing/dashes", () => {
    expect(phoneDigits("+972 50-123-4567")).toBe("972501234567");
    expect(phoneDigits("+972501234567")).toBe("972501234567");
  });

  it("returns '' for a string with no digits", () => {
    expect(phoneDigits("abc")).toBe("");
  });
});

describe("formatBytes", () => {
  it("renders sub-KB sizes as at least 1 KB, rounded", () => {
    expect(formatBytes(500)).toBe("1 KB");
  });

  it("renders whole KB counts with rounding", () => {
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(1536)).toBe("2 KB"); // rounds 1.5 KB up
  });

  it("switches to MB with one decimal above 1 MiB", () => {
    expect(formatBytes(1_048_577)).toBe("1.0 MB");
    expect(formatBytes(1_887_437)).toBe("1.8 MB");
  });

  it("treats exactly 1 MiB as still KB (boundary is 'greater than', not 'at least')", () => {
    expect(formatBytes(1_048_576)).toBe("1024 KB");
  });
});

describe("artKeyForId", () => {
  const ART_KEYS = Object.keys(ARTS);

  it("is deterministic for the same id", () => {
    expect(artKeyForId("order-item-abc")).toBe(artKeyForId("order-item-abc"));
  });

  it("always returns a real ARTS key", () => {
    for (const id of ["a", "order-1", "", "z".repeat(50)]) {
      expect(ART_KEYS).toContain(artKeyForId(id));
    }
  });

  it("differs across at least some distinct ids (hash isn't a constant)", () => {
    const keys = new Set(["id-1", "id-2", "id-3", "id-4", "id-5"].map(artKeyForId));
    expect(keys.size).toBeGreaterThan(1);
  });
});
