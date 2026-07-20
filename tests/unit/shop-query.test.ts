import { describe, expect, it } from "vitest";
import {
  buildShopQuery,
  categoryToProductType,
  DEFAULT_SORT,
  parseShopQuery,
  SHOP_PAGE_SIZE,
} from "@/components/storefront/shop-query";
import { ProductType } from "@/generated/prisma/enums";
import { DEFAULT_PAGE_SIZE } from "@/lib/catalog/types";

describe("SHOP_PAGE_SIZE", () => {
  it("reuses the catalog's default page size", () => {
    expect(SHOP_PAGE_SIZE).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe("parseShopQuery — defaults", () => {
  it("returns every default for an empty params object", () => {
    expect(parseShopQuery({})).toEqual({
      cat: "all",
      q: "",
      sort: DEFAULT_SORT,
      size: "",
      color: "",
      price: "",
      stock: false,
      page: 1,
    });
  });
});

describe("parseShopQuery — cat", () => {
  it("accepts 'shirts' and 'paintings'", () => {
    expect(parseShopQuery({ cat: "shirts" }).cat).toBe("shirts");
    expect(parseShopQuery({ cat: "paintings" }).cat).toBe("paintings");
  });

  it("falls back to 'all' for an unknown value", () => {
    expect(parseShopQuery({ cat: "sculptures" }).cat).toBe("all");
  });

  it("takes the first value when the param is repeated in the URL", () => {
    expect(parseShopQuery({ cat: ["shirts", "paintings"] }).cat).toBe("shirts");
  });
});

describe("parseShopQuery — q", () => {
  it("trims surrounding whitespace", () => {
    expect(parseShopQuery({ q: "  desert sun  " }).q).toBe("desert sun");
  });

  it("defaults to '' when absent", () => {
    expect(parseShopQuery({}).q).toBe("");
  });
});

describe("parseShopQuery — sort", () => {
  it.each(["featured", "new", "priceAsc", "priceDesc"])("accepts '%s'", (sort) => {
    expect(parseShopQuery({ sort }).sort).toBe(sort);
  });

  it("falls back to the default for an unknown sort", () => {
    expect(parseShopQuery({ sort: "random" }).sort).toBe(DEFAULT_SORT);
  });
});

describe("parseShopQuery — size/color", () => {
  it("passes through arbitrary size/color codes unvalidated", () => {
    expect(parseShopQuery({ size: "M", color: "sand" })).toMatchObject({ size: "M", color: "sand" });
  });

  it("defaults both to ''", () => {
    expect(parseShopQuery({})).toMatchObject({ size: "", color: "" });
  });
});

describe("parseShopQuery — price bucket", () => {
  it.each(["a", "b", "c"])("accepts bucket '%s'", (price) => {
    expect(parseShopQuery({ price }).price).toBe(price);
  });

  it("rejects an unknown bucket back to ''", () => {
    expect(parseShopQuery({ price: "z" }).price).toBe("");
  });
});

describe("parseShopQuery — stock", () => {
  it("treats '1' as true", () => {
    expect(parseShopQuery({ stock: "1" }).stock).toBe(true);
  });

  it("treats 'true' as true", () => {
    expect(parseShopQuery({ stock: "true" }).stock).toBe(true);
  });

  it("treats '0' and anything else as false", () => {
    expect(parseShopQuery({ stock: "0" }).stock).toBe(false);
    expect(parseShopQuery({ stock: "yes" }).stock).toBe(false);
  });

  it("defaults to false when absent", () => {
    expect(parseShopQuery({}).stock).toBe(false);
  });
});

describe("parseShopQuery — page clamping", () => {
  it("floors a fractional page", () => {
    expect(parseShopQuery({ page: "2.9" }).page).toBe(2);
  });

  it("clamps page 0 up to 1", () => {
    expect(parseShopQuery({ page: "0" }).page).toBe(1);
  });

  it("clamps a negative page up to 1", () => {
    expect(parseShopQuery({ page: "-5" }).page).toBe(1);
  });

  it("falls back to 1 for a non-numeric page", () => {
    expect(parseShopQuery({ page: "abc" }).page).toBe(1);
  });

  it("accepts a large valid page number as-is", () => {
    expect(parseShopQuery({ page: "42" }).page).toBe(42);
  });
});

describe("categoryToProductType", () => {
  it("maps 'shirts' to SHIRT and 'paintings' to PAINTING", () => {
    expect(categoryToProductType("shirts")).toBe(ProductType.SHIRT);
    expect(categoryToProductType("paintings")).toBe(ProductType.PAINTING);
  });

  it("maps 'all' to undefined (no type filter)", () => {
    expect(categoryToProductType("all")).toBeUndefined();
  });
});

describe("buildShopQuery", () => {
  it("omits every param that's at its default", () => {
    expect(
      buildShopQuery({ cat: "all", q: "", sort: DEFAULT_SORT, size: "", color: "", price: "", stock: false, page: 1 }),
    ).toEqual({});
  });

  it("includes only the non-default params", () => {
    expect(buildShopQuery({ cat: "shirts", page: 3 })).toEqual({ cat: "shirts", page: "3" });
  });

  it("includes q, size, color, price, and sort when set", () => {
    expect(buildShopQuery({ q: "sun", size: "M", color: "sand", price: "a", sort: "new" })).toEqual({
      q: "sun",
      size: "M",
      color: "sand",
      price: "a",
      sort: "new",
    });
  });

  it("encodes stock as '1' only when true", () => {
    expect(buildShopQuery({ stock: true })).toEqual({ stock: "1" });
    expect(buildShopQuery({ stock: false })).toEqual({});
  });

  it("omits page when it's 1", () => {
    expect(buildShopQuery({ page: 1 })).toEqual({});
  });

  it("round-trips through parseShopQuery for a fully-populated non-default query", () => {
    const parsed = parseShopQuery({
      cat: "paintings",
      q: "desert",
      sort: "priceDesc",
      size: "A4",
      color: "clay",
      price: "b",
      stock: "1",
      page: "4",
    });
    const built = buildShopQuery(parsed);
    expect(parseShopQuery(built as Record<string, string>)).toEqual(parsed);
  });
});
