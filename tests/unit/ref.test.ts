import { describe, expect, it } from "vitest";
import { formatOrderRef, ORDER_REF_PATTERN } from "@/lib/orders/ref";

describe("formatOrderRef", () => {
  it("formats a number as RA-<n>", () => {
    expect(formatOrderRef(1042)).toBe("RA-1042");
  });

  it("formats small numbers without padding", () => {
    expect(formatOrderRef(1)).toBe("RA-1");
  });

  it("formats zero", () => {
    expect(formatOrderRef(0)).toBe("RA-0");
  });
});

describe("ORDER_REF_PATTERN", () => {
  it("matches well-formed refs", () => {
    expect(ORDER_REF_PATTERN.test("RA-1042")).toBe(true);
    expect(ORDER_REF_PATTERN.test("RA-1")).toBe(true);
  });

  it("rejects malformed refs", () => {
    expect(ORDER_REF_PATTERN.test("RA-")).toBe(false);
    expect(ORDER_REF_PATTERN.test("ra-1042")).toBe(false);
    expect(ORDER_REF_PATTERN.test("RA-10x2")).toBe(false);
    expect(ORDER_REF_PATTERN.test("1042")).toBe(false);
    expect(ORDER_REF_PATTERN.test("XX-RA-1042")).toBe(false);
  });

  it("round-trips with formatOrderRef", () => {
    expect(ORDER_REF_PATTERN.test(formatOrderRef(9999))).toBe(true);
  });
});
