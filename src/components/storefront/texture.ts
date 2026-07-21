/**
 * Typed access to the procedural texture system defined in `src/styles/textures.css`.
 *
 * Two ways to use a texture, and the choice matters:
 *
 *  - From CSS (preferred): `background-image: var(--texture-linen);`. Custom properties are not
 *    scoped by CSS Modules, so this always resolves.
 *  - From TSX, when the surface is data-driven (a product's art key, a per-item tint): the
 *    helpers below build the same `background-image` strings that CSS would.
 *
 * This mirrors `art.ts` deliberately — same shape, same composition order — so the two systems
 * stack without surprises. `art.ts` supplies the ARTWORK (colour fields standing in for
 * photography); this supplies the MATERIAL it is printed on.
 *
 * Composition order is texture-first, matching `grainedArt()`: in a CSS background-image list
 * the first layer paints on top, so the weave sits over the colour rather than under it.
 *
 * INVARIANT: every `--texture-*` value must be a bare `<image>` — a url() or a gradient with NO
 * position/size attached. `<image> <position> / <size>` is `background` SHORTHAND syntax; inside
 * `background-image` it makes the whole declaration invalid and the browser drops it silently,
 * artwork layers and all. That shipped once and rendered two homepage tiles blank. Size a texture
 * at the point of use with `background-size`. Enforced by tests/unit/texture.test.ts.
 */

/** Texture names, 1:1 with the `--texture-*` custom properties in textures.css. */
export const TEXTURES = {
  grain: "var(--texture-grain)",
  paperFiber: "var(--texture-paper-fiber)",
  linen: "var(--texture-linen)",
  canvas: "var(--texture-canvas)",
  weaveSoft: "var(--texture-weave-soft)",
  stitch: "var(--texture-stitch)",
  stitchSienna: "var(--texture-stitch-sienna)",
  thread: "var(--texture-thread)",
  halftone: "var(--texture-halftone)",
  press: "var(--texture-press)",
} as const satisfies Record<string, string>;

export type TextureKey = keyof typeof TEXTURES;

/** Pre-composed surfaces, 1:1 with the `--surface-*` custom properties. */
export const SURFACES = {
  paper: "var(--surface-paper)",
  linenBand: "var(--surface-linen-band)",
  canvas: "var(--surface-canvas)",
  ink: "var(--surface-ink)",
} as const satisfies Record<string, string>;

export type SurfaceKey = keyof typeof SURFACES;

/**
 * Layer one or more textures over a base background.
 *
 * @param base   Any valid background-image value — a gradient, an ARTS entry, or `undefined`
 *               for texture only.
 * @param keys   Textures to stack, painted in the order given (first is topmost).
 *
 * @example textured(ARTS.dawn, "canvas", "grain")  // canvas over grain over the dawn gradient
 */
export function textured(base: string | undefined, ...keys: TextureKey[]): string {
  // Annotated as string[]: `satisfies` narrows TEXTURES' values to string literals, so without
  // this the array infers as that literal union and rejects an arbitrary `base`.
  const layers: string[] = keys.map((k) => TEXTURES[k]);
  if (base) layers.push(base);
  return layers.join(", ");
}

/**
 * A garment-coloured swatch: solid colour under a soft weave, so a colour chip reads as cloth
 * rather than as a flat circle. Used by the product colour pickers and the hero shirt mock.
 *
 * Takes a raw colour rather than a swatch token name because the values come from the database
 * (Color.hex), not from the token set.
 */
export function fabricSwatch(hex: string): string {
  return `${TEXTURES.weaveSoft}, ${TEXTURES.grain}, linear-gradient(160deg, ${hex} 0%, ${hex} 100%)`;
}

/**
 * A framed-canvas surface for painting mockups — the canvas weave plus a subtle corner-lit
 * gradient, which is what makes a flat rectangle read as a stretched canvas catching light.
 */
export function canvasSurface(art: string): string {
  return `${TEXTURES.canvas}, radial-gradient(120% 100% at 22% 12%, rgba(255, 250, 240, 0.28) 0%, rgba(255, 250, 240, 0) 55%), ${art}`;
}

/**
 * A hand-pulled print surface — halftone dot screen plus ink mottle over the artwork.
 */
export function printSurface(art: string): string {
  return `${TEXTURES.halftone}, ${TEXTURES.press}, ${art}`;
}
