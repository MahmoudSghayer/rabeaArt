import { describe, expect, it } from "vitest";
import {
  SURFACES,
  TEXTURES,
  canvasSurface,
  fabricSwatch,
  printSurface,
  textured,
} from "@/components/storefront/texture";
import { ARTS } from "@/components/storefront/art";

/**
 * These lock the two things that are easy to break silently: the custom-property NAMES (a typo
 * yields `var(--texture-linnen)`, which CSS ignores without complaint, leaving an untextured
 * surface that looks merely "a bit flat") and the layer ORDER (reverse it and the texture hides
 * behind the colour instead of sitting on it).
 */

describe("TEXTURES / SURFACES", () => {
  it("every texture points at a var() reference", () => {
    for (const [key, value] of Object.entries(TEXTURES)) {
      expect(value, `${key} should be a var() reference`).toMatch(/^var\(--texture-[a-z-]+\)$/);
    }
  });

  it("every surface points at a var() reference", () => {
    for (const [key, value] of Object.entries(SURFACES)) {
      expect(value, `${key} should be a var() reference`).toMatch(/^var\(--surface-[a-z-]+\)$/);
    }
  });

  it("maps camelCase keys onto kebab-case custom properties", () => {
    expect(TEXTURES.paperFiber).toBe("var(--texture-paper-fiber)");
    expect(TEXTURES.weaveSoft).toBe("var(--texture-weave-soft)");
    expect(TEXTURES.stitchSienna).toBe("var(--texture-stitch-sienna)");
    expect(SURFACES.linenBand).toBe("var(--surface-linen-band)");
  });
});

describe("textured", () => {
  it("paints textures before the base, so the weave sits on top of the colour", () => {
    expect(textured(ARTS.dawn, "canvas")).toBe(`${TEXTURES.canvas}, ${ARTS.dawn}`);
  });

  it("keeps multiple textures in the order given", () => {
    expect(textured(ARTS.sea, "canvas", "grain")).toBe(
      `${TEXTURES.canvas}, ${TEXTURES.grain}, ${ARTS.sea}`,
    );
  });

  it("returns texture-only output when there is no base", () => {
    expect(textured(undefined, "linen")).toBe(TEXTURES.linen);
  });

  it("returns an empty string when given nothing to compose", () => {
    expect(textured(undefined)).toBe("");
  });
});

describe("fabricSwatch", () => {
  it("puts weave and grain over the garment colour", () => {
    const out = fabricSwatch("#2a2620");
    expect(out.startsWith(TEXTURES.weaveSoft)).toBe(true);
    expect(out).toContain(TEXTURES.grain);
    // The colour must be last — it is the layer everything else composites onto.
    expect(out.endsWith("linear-gradient(160deg, #2a2620 0%, #2a2620 100%)")).toBe(true);
  });

  it("passes the hex through untouched, including DB values in any case", () => {
    expect(fabricSwatch("#B7472A")).toContain("#B7472A");
  });
});

describe("canvasSurface / printSurface", () => {
  it("canvasSurface adds weave and a corner highlight above the art", () => {
    const out = canvasSurface(ARTS.garden);
    expect(out.startsWith(TEXTURES.canvas)).toBe(true);
    expect(out).toContain("radial-gradient");
    expect(out.endsWith(ARTS.garden)).toBe(true);
  });

  it("printSurface adds halftone and ink mottle above the art", () => {
    const out = printSurface(ARTS.letters);
    expect(out.startsWith(TEXTURES.halftone)).toBe(true);
    expect(out).toContain(TEXTURES.press);
    expect(out.endsWith(ARTS.letters)).toBe(true);
  });
});
