import { describe, expect, it } from "vitest";
import { decideCustomerMatch, normalizeEmail, normalizePhone } from "@/lib/customer-matching";

describe("normalizePhone", () => {
  it("normalizes an IL local-format number to E.164 using the default region", () => {
    expect(normalizePhone("050-123-4567")).toBe("+972501234567");
  });

  it("normalizes a number with spaces instead of dashes", () => {
    expect(normalizePhone("050 123 4567")).toBe("+972501234567");
  });

  it("passes through an already-international number regardless of default region", () => {
    expect(normalizePhone("+1 202-555-0143")).toBe("+12025550143");
  });

  it("honors an explicit defaultRegion override", () => {
    expect(normalizePhone("020 7946 0958", "GB")).toBe("+442079460958");
  });

  it("returns null for garbage input", () => {
    expect(normalizePhone("not a phone number")).toBeNull();
  });

  it("returns null for empty input without throwing", () => {
    expect(normalizePhone("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(normalizePhone("   ")).toBeNull();
  });

  it("returns null for a too-short number without throwing", () => {
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases a valid email", () => {
    expect(normalizeEmail("  Nour.KH@Gmail.com  ")).toBe("nour.kh@gmail.com");
  });

  it("returns null for empty input", () => {
    expect(normalizeEmail("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("returns null for a string with no @", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
  });

  it("returns null for a string with no domain dot", () => {
    expect(normalizeEmail("nour@gmail")).toBeNull();
  });

  it("returns null when there is whitespace inside the address", () => {
    expect(normalizeEmail("nour @gmail.com")).toBeNull();
  });
});

describe("decideCustomerMatch", () => {
  const candidates = [
    { id: "cust-1", phoneNormalized: "+972501234567", emailNormalized: "nour@gmail.com" },
    { id: "cust-2", phoneNormalized: "+972529998888", emailNormalized: "sami@outlook.com" },
  ];

  it("matches on exact phone", () => {
    expect(
      decideCustomerMatch({ phoneNormalized: "+972501234567", emailNormalized: null }, candidates),
    ).toEqual({ kind: "match", id: "cust-1" });
  });

  it("matches on exact email when phone doesn't match", () => {
    expect(
      decideCustomerMatch({ phoneNormalized: null, emailNormalized: "sami@outlook.com" }, candidates),
    ).toEqual({ kind: "match", id: "cust-2" });
  });

  it("prefers the phone match when phone and email both match the same candidate", () => {
    expect(
      decideCustomerMatch(
        { phoneNormalized: "+972501234567", emailNormalized: "nour@gmail.com" },
        candidates,
      ),
    ).toEqual({ kind: "match", id: "cust-1" });
  });

  it("returns 'new' when neither phone nor email match any candidate", () => {
    expect(
      decideCustomerMatch(
        { phoneNormalized: "+972500000000", emailNormalized: "stranger@example.com" },
        candidates,
      ),
    ).toEqual({ kind: "new" });
  });

  it("returns 'new' when both inputs are null", () => {
    expect(decideCustomerMatch({ phoneNormalized: null, emailNormalized: null }, candidates)).toEqual({
      kind: "new",
    });
  });

  it("returns 'conflict' when phone and email match two different candidates", () => {
    expect(
      decideCustomerMatch(
        { phoneNormalized: "+972501234567", emailNormalized: "sami@outlook.com" },
        candidates,
      ),
    ).toEqual({ kind: "conflict", phoneMatchId: "cust-1", emailMatchId: "cust-2" });
  });

  it("never auto-merges on conflict — caller is expected to create a new customer", () => {
    const result = decideCustomerMatch(
      { phoneNormalized: "+972501234567", emailNormalized: "sami@outlook.com" },
      candidates,
    );
    expect(result.kind).toBe("conflict");
  });
});
