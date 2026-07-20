import { describe, expect, it } from "vitest";
import { artKeyForSlug, productArtBackground, resolveArtKey } from "@/components/storefront/product-art";
import { ARTS, GRAIN } from "@/components/storefront/art";

describe("resolveArtKey", () => {
  it("accepts a real ARTS key", () => {
    expect(resolveArtKey("rivers")).toBe("rivers");
  });

  it.each([null, undefined, "", "not-a-key"])("falls back to 'still' for %j", (value) => {
    expect(resolveArtKey(value)).toBe("still");
  });
});

describe("artKeyForSlug", () => {
  it("takes the part after the first dash as the art key", () => {
    expect(artKeyForSlug("sh-dawn")).toBe("dawn");
    expect(artKeyForSlug("pa-rivers")).toBe("rivers");
  });

  it("only splits on the FIRST dash — later dashes stay part of the key candidate", () => {
    // "pa-city-skyline" -> suffix "city-skyline", which isn't a real ARTS key, so it falls back.
    expect(artKeyForSlug("pa-city-skyline")).toBe("still");
  });

  it("falls back to 'still' when the slug has no dash at all", () => {
    expect(artKeyForSlug("nodash")).toBe("still");
  });

  it("falls back to 'still' when the suffix doesn't match any ARTS key", () => {
    expect(artKeyForSlug("sh-unknownkey")).toBe("still");
  });

  it("resolves every real ARTS key when used as a slug suffix", () => {
    for (const key of Object.keys(ARTS)) {
      expect(artKeyForSlug(`sh-${key}`)).toBe(key);
    }
  });
});

describe("productArtBackground", () => {
  it("layers the grain texture on top of the resolved gradient", () => {
    expect(productArtBackground("sh-dawn")).toBe(`${GRAIN}, ${ARTS.dawn}`);
  });

  it("falls back to the 'still' gradient for an unresolvable slug", () => {
    expect(productArtBackground("mystery-product")).toBe(`${GRAIN}, ${ARTS.still}`);
  });
});
