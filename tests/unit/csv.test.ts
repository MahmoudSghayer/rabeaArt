import { describe, expect, it } from "vitest";
import { csvResponseBody, sanitizeCell, toCsv } from "@/lib/csv";

describe("sanitizeCell", () => {
  it.each([["="], ["+"], ["-"], ["@"], ["\t"], ["\r"]])(
    "prefixes a value starting with %j with a single quote",
    (trigger) => {
      expect(sanitizeCell(`${trigger}SUM(A1:A2)`)).toBe(`'${trigger}SUM(A1:A2)`);
    },
  );

  it("prefixes even when the trigger char is after leading whitespace", () => {
    expect(sanitizeCell("  =cmd()")).toBe("'  =cmd()");
  });

  it("leaves ordinary text untouched", () => {
    expect(sanitizeCell("Nour al-Khatib")).toBe("Nour al-Khatib");
  });

  it("leaves empty strings untouched", () => {
    expect(sanitizeCell("")).toBe("");
  });
});

describe("toCsv", () => {
  it("quotes every field, including plain ones", () => {
    const csv = toCsv(["Name", "Phone"], [["Nour", "0501234567"]]);
    expect(csv).toBe('"Name","Phone"\r\n"Nour","0501234567"');
  });

  it("doubles embedded double quotes", () => {
    const csv = toCsv(["Notes"], [['She said "hello"']]);
    expect(csv).toBe('"Notes"\r\n"She said ""hello"""');
  });

  it("joins rows with CRLF", () => {
    const csv = toCsv(["A"], [["1"], ["2"], ["3"]]);
    expect(csv.split("\r\n")).toEqual(['"A"', '"1"', '"2"', '"3"']);
  });

  it("sanitizes formula-injection characters inside cells before quoting", () => {
    const csv = toCsv(["Notes"], [["=1+1"]]);
    expect(csv).toBe('"Notes"\r\n"\'=1+1"');
  });

  it("handles an empty rows list (header only)", () => {
    expect(toCsv(["A", "B"], [])).toBe('"A","B"');
  });
});

describe("csvResponseBody", () => {
  it("prepends a UTF-8 BOM", () => {
    const body = csvResponseBody("a,b");
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body.slice(1)).toBe("a,b");
  });
});
