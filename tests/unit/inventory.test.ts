import { describe, expect, it } from "vitest";
import { aggregateQtyByVariant, findShortVariantIds } from "@/lib/inventory/decide";
import { InventoryError } from "@/lib/inventory/errors";

/**
 * Only the pure decision helpers (decide.ts) are unit-tested here — `applyStock`/`releaseStock`
 * themselves are thin Prisma-transaction wrappers around this math and need a real (or heavily
 * mocked) `Prisma.TransactionClient` to exercise meaningfully, which belongs in an integration
 * test suite against a real database, not this unit layer (see project plan: "DB-touching parts
 * get integration tests later").
 */

describe("aggregateQtyByVariant", () => {
  it("sums qty per variant across multiple line items", () => {
    const totals = aggregateQtyByVariant([
      { variantId: "v1", qty: 2 },
      { variantId: "v2", qty: 1 },
      { variantId: "v1", qty: 3 },
    ]);
    expect(totals.get("v1")).toBe(5);
    expect(totals.get("v2")).toBe(1);
    expect(totals.size).toBe(2);
  });

  it("returns an empty map for no items", () => {
    expect(aggregateQtyByVariant([]).size).toBe(0);
  });

  it("keeps a single item's qty as-is", () => {
    const totals = aggregateQtyByVariant([{ variantId: "v1", qty: 4 }]);
    expect(totals.get("v1")).toBe(4);
  });
});

describe("findShortVariantIds", () => {
  it("returns no shortfalls when every variant has enough stock", () => {
    const needed = aggregateQtyByVariant([{ variantId: "v1", qty: 2 }]);
    const stock = new Map([["v1", 5]]);
    expect(findShortVariantIds(needed, stock)).toEqual([]);
  });

  it("flags a variant whose needed qty exceeds its stock", () => {
    const needed = aggregateQtyByVariant([{ variantId: "v1", qty: 6 }]);
    const stock = new Map([["v1", 5]]);
    expect(findShortVariantIds(needed, stock)).toEqual(["v1"]);
  });

  it("treats exactly-enough stock as sufficient (not short)", () => {
    const needed = aggregateQtyByVariant([{ variantId: "v1", qty: 5 }]);
    const stock = new Map([["v1", 5]]);
    expect(findShortVariantIds(needed, stock)).toEqual([]);
  });

  it("treats a variant missing from the stock map as having 0 available", () => {
    const needed = aggregateQtyByVariant([{ variantId: "v1", qty: 1 }]);
    const stock = new Map<string, number>();
    expect(findShortVariantIds(needed, stock)).toEqual(["v1"]);
  });

  it("flags only the short variants among several", () => {
    const needed = aggregateQtyByVariant([
      { variantId: "v1", qty: 2 },
      { variantId: "v2", qty: 10 },
      { variantId: "v3", qty: 1 },
    ]);
    const stock = new Map([
      ["v1", 5],
      ["v2", 3],
      ["v3", 0],
    ]);
    expect(findShortVariantIds(needed, stock).sort()).toEqual(["v2", "v3"]);
  });

  it("aggregates before checking, catching a combined shortfall a per-line check would miss", () => {
    // Two line items of 3 each against a variant with only 5 in stock: individually each line
    // (3) is under stock (5), but combined (6) exceeds it.
    const needed = aggregateQtyByVariant([
      { variantId: "v1", qty: 3 },
      { variantId: "v1", qty: 3 },
    ]);
    const stock = new Map([["v1", 5]]);
    expect(findShortVariantIds(needed, stock)).toEqual(["v1"]);
  });
});

describe("InventoryError", () => {
  it("carries structured shortfalls and a readable summary message", () => {
    const err = new InventoryError([
      { variantId: "v1", label: "Dawn Threads Shirt (Ink / M)", needed: 3, available: 1 },
    ]);
    expect(err.name).toBe("InventoryError");
    expect(err.shortfalls).toHaveLength(1);
    expect(err.message).toContain("Dawn Threads Shirt (Ink / M)");
    expect(err.message).toContain("need 3, have 1");
  });
});
