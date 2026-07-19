import { describe, expect, it } from "vitest";
import { OrderStatus } from "@/generated/prisma/enums";
import { isValidTransition, stockActionForTransition } from "@/lib/orders/transitions";

describe("stockActionForTransition", () => {
  it("applies stock when entering ACCEPTED for the first time", () => {
    expect(
      stockActionForTransition({ from: OrderStatus.QUOTED, to: OrderStatus.ACCEPTED, stockApplied: false }),
    ).toBe("apply");
  });

  it("is idempotent: re-entering/staying in ACCEPTED with stock already applied does nothing", () => {
    expect(
      stockActionForTransition({ from: OrderStatus.ACCEPTED, to: OrderStatus.ACCEPTED, stockApplied: true }),
    ).toBe("none");
  });

  it("does not re-apply if somehow re-targeting ACCEPTED with stockApplied already true", () => {
    expect(
      stockActionForTransition({ from: OrderStatus.NEEDS_INFO, to: OrderStatus.ACCEPTED, stockApplied: true }),
    ).toBe("none");
  });

  it.each([OrderStatus.PROGRESS, OrderStatus.READY, OrderStatus.COMPLETED])(
    "does nothing when moving within the stock-holding family into %s (stock already applied)",
    (to) => {
      expect(stockActionForTransition({ from: OrderStatus.ACCEPTED, to, stockApplied: true })).toBe("none");
    },
  );

  it("releases stock when moving from ACCEPTED back to a review-family status", () => {
    expect(
      stockActionForTransition({ from: OrderStatus.ACCEPTED, to: OrderStatus.NEEDS_INFO, stockApplied: true }),
    ).toBe("release");
  });

  it("releases stock when moving from PROGRESS to CANCELLED", () => {
    expect(
      stockActionForTransition({ from: OrderStatus.PROGRESS, to: OrderStatus.CANCELLED, stockApplied: true }),
    ).toBe("release");
  });

  it("releases stock when moving from READY to DECLINED", () => {
    expect(
      stockActionForTransition({ from: OrderStatus.READY, to: OrderStatus.DECLINED, stockApplied: true }),
    ).toBe("release");
  });

  it("does nothing when leaving the stock-holding family but stock was never applied", () => {
    expect(
      stockActionForTransition({ from: OrderStatus.COMPLETED, to: OrderStatus.REVIEW, stockApplied: false }),
    ).toBe("none");
  });

  it("does nothing for review-family-to-review-family moves", () => {
    expect(
      stockActionForTransition({ from: OrderStatus.NEW, to: OrderStatus.REVIEW, stockApplied: false }),
    ).toBe("none");
  });

  it("does nothing moving from QUOTED to DECLINED when stock was never applied", () => {
    expect(
      stockActionForTransition({ from: OrderStatus.QUOTED, to: OrderStatus.DECLINED, stockApplied: false }),
    ).toBe("none");
  });
});

describe("isValidTransition", () => {
  it("rejects a same-status no-op", () => {
    expect(isValidTransition(OrderStatus.REVIEW, OrderStatus.REVIEW)).toBe(false);
  });

  it("allows arbitrary jumps between non-terminal statuses", () => {
    expect(isValidTransition(OrderStatus.NEW, OrderStatus.ACCEPTED)).toBe(true);
    expect(isValidTransition(OrderStatus.ACCEPTED, OrderStatus.NEEDS_INFO)).toBe(true);
    expect(isValidTransition(OrderStatus.PROGRESS, OrderStatus.DECLINED)).toBe(true);
  });

  it("allows moving into COMPLETED or CANCELLED from any non-terminal status", () => {
    expect(isValidTransition(OrderStatus.READY, OrderStatus.COMPLETED)).toBe(true);
    expect(isValidTransition(OrderStatus.PROGRESS, OrderStatus.CANCELLED)).toBe(true);
  });

  it("allows re-opening a COMPLETED order via REVIEW", () => {
    expect(isValidTransition(OrderStatus.COMPLETED, OrderStatus.REVIEW)).toBe(true);
  });

  it("allows re-opening a CANCELLED order via REVIEW", () => {
    expect(isValidTransition(OrderStatus.CANCELLED, OrderStatus.REVIEW)).toBe(true);
  });

  it("rejects any other destination from COMPLETED", () => {
    expect(isValidTransition(OrderStatus.COMPLETED, OrderStatus.ACCEPTED)).toBe(false);
    expect(isValidTransition(OrderStatus.COMPLETED, OrderStatus.PROGRESS)).toBe(false);
    expect(isValidTransition(OrderStatus.COMPLETED, OrderStatus.CANCELLED)).toBe(false);
  });

  it("rejects any other destination from CANCELLED", () => {
    expect(isValidTransition(OrderStatus.CANCELLED, OrderStatus.ACCEPTED)).toBe(false);
    expect(isValidTransition(OrderStatus.CANCELLED, OrderStatus.COMPLETED)).toBe(false);
  });
});
