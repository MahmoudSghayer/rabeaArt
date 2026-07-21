import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

/**
 * Guards the failure that actually shipped: --texture-halftone was written with background
 * POSITION/SIZE baked in (`radial-gradient(...) 0 0 / 7px 7px`). That is `background` SHORTHAND
 * syntax. `<image> <position> / <size>` is not an `<image>`, so every `background-image` built
 * from it was invalid and the browser dropped the WHOLE declaration — artwork layers included.
 * Two homepage tiles rendered blank with no error, no warning, and a perfectly plausible-looking
 * inline style.
 *
 * Deliberately NOT tested with `CSS.supports("background-image", printSurface("red"))`, which is
 * the obvious-looking check and is worthless here for two independent reasons:
 *
 *   1. printSurface() emits `var(--texture-halftone), ...`. A declaration containing var() is
 *      valid at PARSE time whatever the variable holds — substitution happens later, and a bad
 *      substitution fails at computed-value time. So CSS.supports returns true for the broken
 *      value and the passing value alike. Verified in Chromium: supports("background-image",
 *      "var(--texture-halftone), var(--texture-press), red") === true even when the token was
 *      the broken shorthand form.
 *   2. jsdom, which these tests run in, does not implement CSS.supports at all.
 *
 * So the check has to read the real token values out of textures.css and assert each layer is a
 * bare <image>. That is the invariant the stylesheet's own comment promises.
 */
describe("textures.css tokens are valid background-image values", () => {
  const cssPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../src/styles/textures.css",
  );
  const css = readFileSync(cssPath, "utf8");

  /** Split on a delimiter only at paren depth 0, so commas inside gradients stay put. */
  function splitTopLevel(value: string, delimiter: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let buf = "";
    for (const ch of value) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === delimiter && depth === 0) {
        out.push(buf.trim());
        buf = "";
      } else buf += ch;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  /** The first `:root { ... }` block, comments stripped. */
  function rootDeclarations(source: string): Record<string, string> {
    const clean = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const start = clean.indexOf("{", clean.indexOf(":root"));
    let depth = 0;
    let end = -1;
    for (let i = start; i < clean.length; i++) {
      if (clean[i] === "{") depth++;
      else if (clean[i] === "}" && --depth === 0) {
        end = i;
        break;
      }
    }
    const props: Record<string, string> = {};
    for (const decl of splitTopLevel(clean.slice(start + 1, end), ";")) {
      const match = decl.match(/^\s*(--[a-z0-9-]+)\s*:([\s\S]*)$/);
      if (match) props[match[1]] = match[2].trim().replace(/\s+/g, " ");
    }
    return props;
  }

  /** Substitute var() references until a literal value remains. */
  function resolve(value: string, props: Record<string, string>): string {
    let out = value;
    for (let pass = 0; pass < 10 && out.includes("var("); pass++) {
      out = out.replace(/var\((--[a-z0-9-]+)\)/g, (whole, name: string) => props[name] ?? whole);
    }
    return out;
  }

  /**
   * A single background-image layer must be exactly one function call (or `none`). Anything
   * trailing the closing paren is a position/size pair — the shorthand-only syntax that broke it.
   */
  function isBareImage(layer: string): boolean {
    if (layer === "none") return true;
    const head = layer.match(/^(?:-webkit-)?(?:repeating-)?[a-z-]+\(/);
    if (!head) return false;
    let depth = 0;
    let i = head[0].length - 1;
    for (; i < layer.length; i++) {
      if (layer[i] === "(") depth++;
      else if (layer[i] === ")" && --depth === 0) break;
    }
    return layer.slice(i + 1).trim() === "";
  }

  const props = rootDeclarations(css);
  const tokens = Object.keys(props).filter(
    (n) => n.startsWith("--texture-") || n.startsWith("--surface-"),
  );

  it("finds the tokens (guards against the parser silently matching nothing)", () => {
    expect(tokens.length).toBeGreaterThanOrEqual(14);
    expect(tokens).toContain("--texture-halftone");
    expect(tokens).toContain("--surface-paper");
  });

  it.each(tokens)("%s is a list of bare <image> layers", (name) => {
    const layers = splitTopLevel(resolve(props[name], props), ",");
    expect(layers.length).toBeGreaterThan(0);
    for (const layer of layers) {
      expect(isBareImage(layer), `${name} has a layer that is not a bare <image>: "${layer}"`).toBe(
        true,
      );
    }
  });

  it("rejects the exact value that shipped broken", () => {
    // If this ever passes, isBareImage() has stopped catching the regression it exists for.
    const broken =
      "radial-gradient(circle at 1px 1px, rgba(35,32,27,0.09) 1px, transparent 1.4px) 0 0 / 7px 7px";
    expect(isBareImage(broken)).toBe(false);
  });

  it.each([
    ["printSurface", printSurface(ARTS.dawn)],
    ["canvasSurface", canvasSurface(ARTS.saffron)],
    ["fabricSwatch", fabricSwatch("#b7472a")],
    ["textured", textured(ARTS.sea, "canvas", "grain")],
  ])("%s resolves to bare <image> layers", (_label, value) => {
    for (const layer of splitTopLevel(resolve(value, props), ",")) {
      expect(isBareImage(layer), `not a bare <image>: "${layer}"`).toBe(true);
    }
  });
});
