import { describe, expect, it } from "vitest";
import { cartTotals, estTotalForOrder, paintingUnitPrice, shirtUnitPrice } from "@/lib/pricing";

describe("shirtUnitPrice", () => {
  it("uses the sale price when set", () => {
    expect(shirtUnitPrice({ price: 150, sale: 120 })).toBe(120);
  });

  it("falls back to the base price when sale is null", () => {
    expect(shirtUnitPrice({ price: 130, sale: null })).toBe(130);
  });

  it("treats a sale of 0 as a real price, not a missing one", () => {
    expect(shirtUnitPrice({ price: 130, sale: 0 })).toBe(0);
  });
});

describe("paintingUnitPrice", () => {
  it("sums the size price and the frame add-on", () => {
    expect(paintingUnitPrice(320, 60)).toBe(380);
  });

  it("handles a zero frame add-on (no frame)", () => {
    expect(paintingUnitPrice(150, 0)).toBe(150);
  });
});

describe("cartTotals", () => {
  it("sums unitPrice * qty for priced items", () => {
    const totals = cartTotals([
      { unitPrice: 100, qty: 2 },
      { unitPrice: 50, qty: 1 },
    ]);
    expect(totals).toEqual({ est: 250, manual: 0, count: 3 });
  });

  it("excludes manual items from est and counts them once per item, not by qty", () => {
    const totals = cartTotals([
      { unitPrice: null, qty: 12 },
      { unitPrice: 100, qty: 1 },
    ]);
    expect(totals).toEqual({ est: 100, manual: 1, count: 13 });
  });

  it("counts multiple manual items separately", () => {
    const totals = cartTotals([
      { unitPrice: null, qty: 1 },
      { unitPrice: null, qty: 5 },
    ]);
    expect(totals).toEqual({ est: 0, manual: 2, count: 6 });
  });

  it("returns all zeros for an empty cart", () => {
    expect(cartTotals([])).toEqual({ est: 0, manual: 0, count: 0 });
  });
});

describe("estTotalForOrder", () => {
  it("returns null when the order is fully manual (manual > 0 and est === 0)", () => {
    expect(estTotalForOrder({ est: 0, manual: 1 })).toBeNull();
  });

  it("returns the estimate when some items are priced even if others are manual", () => {
    expect(estTotalForOrder({ est: 100, manual: 1 })).toBe(100);
  });

  it("returns 0 (not null) when there are no manual items and est is genuinely 0", () => {
    expect(estTotalForOrder({ est: 0, manual: 0 })).toBe(0);
  });

  it("returns the estimate for a fully priced order", () => {
    expect(estTotalForOrder({ est: 250, manual: 0 })).toBe(250);
  });
});
