import { describe, expect, it } from "vitest";
import { summarizeOptions } from "@/app/admin/orders/optionsSummary";

describe("summarizeOptions — shape guards", () => {
  it("returns [] for null/undefined", () => {
    expect(summarizeOptions(null)).toEqual([]);
    expect(summarizeOptions(undefined)).toEqual([]);
  });

  it("returns [] for a non-object primitive", () => {
    expect(summarizeOptions("shirt")).toEqual([]);
    expect(summarizeOptions(42)).toEqual([]);
  });

  it("returns [] for an array (not a plain options object)", () => {
    expect(summarizeOptions(["a", "b"])).toEqual([]);
  });

  it("returns [] for an empty object", () => {
    expect(summarizeOptions({})).toEqual([]);
  });
});

describe("summarizeOptions — shirt-shaped options", () => {
  it("flattens colorCode/sizeCode/method into key/value pairs, preserving order", () => {
    expect(summarizeOptions({ colorCode: "sand", sizeCode: "M", method: "print" })).toEqual([
      { key: "colorCode", value: "sand" },
      { key: "sizeCode", value: "M" },
      { key: "method", value: "print" },
    ]);
  });
});

describe("summarizeOptions — painting-shaped options", () => {
  it("flattens sizeCode/frameCode", () => {
    expect(summarizeOptions({ sizeCode: "A4", frameCode: "wood" })).toEqual([
      { key: "sizeCode", value: "A4" },
      { key: "frameCode", value: "wood" },
    ]);
  });
});

describe("summarizeOptions — custom free-form bag", () => {
  it("joins an array value with ', '", () => {
    expect(summarizeOptions({ placement: ["front", "sleeve"] })).toEqual([
      { key: "placement", value: "front, sleeve" },
    ]);
  });

  it("stringifies a non-string scalar (e.g. a number)", () => {
    expect(summarizeOptions({ width: 40 })).toEqual([{ key: "width", value: "40" }]);
  });

  it("stringifies a boolean", () => {
    expect(summarizeOptions({ framed: true })).toEqual([{ key: "framed", value: "true" }]);
  });
});

describe("summarizeOptions — drops empty entries", () => {
  it("filters out null, undefined, and empty-string values", () => {
    expect(summarizeOptions({ a: null, b: undefined, c: "", d: "kept" })).toEqual([{ key: "d", value: "kept" }]);
  });

  it("keeps a falsy-but-meaningful 0 or false value", () => {
    expect(summarizeOptions({ qty: 0, framed: false })).toEqual([
      { key: "qty", value: "0" },
      { key: "framed", value: "false" },
    ]);
  });

  it("keeps an empty array (stringifies to '')", () => {
    expect(summarizeOptions({ placement: [] })).toEqual([{ key: "placement", value: "" }]);
  });
});
