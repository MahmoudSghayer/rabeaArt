import type {
  CatalogActiveOptions,
  CatalogColorOption,
  CatalogMaterialOption,
  CatalogMethodOption,
  CatalogSizeOption,
  LocalizedText,
} from "@/lib/catalog/types";

/**
 * THE single hardcoded fallback for wizard/order option lists, mirroring prisma/seed.ts
 * (colors, sizes, frames, materials, and every ProductionMethod scope) 1:1. Used whenever
 * `listActiveOptions()` fails — the local dev DB is unreachable by design, and in production a
 * transient DB error must degrade to "the wizard still works with the seed options" rather than
 * a broken page. If the seed changes, update this file to match (and only this file — both the
 * /custom and /order pages import from here).
 */

const fallbackScopes: Record<string, CatalogMethodOption[]> = {
  "shirt-method": [
    { scope: "shirt-method", code: "print", label: { ar: "طباعة", en: "Printing" } },
    { scope: "shirt-method", code: "embroidery", label: { ar: "تطريز", en: "Embroidery" } },
  ],
  placement: [
    { scope: "placement", code: "front", label: { ar: "الأمام", en: "Front" } },
    { scope: "placement", code: "back", label: { ar: "الخلف", en: "Back" } },
    { scope: "placement", code: "sleeve", label: { ar: "الكُم", en: "Sleeve" } },
  ],
  "painting-style": [
    { scope: "painting-style", code: "printed", label: { ar: "صورة مطبوعة", en: "Printed image" } },
    { scope: "painting-style", code: "hand", label: { ar: "لوحة مرسومة يدويًا", en: "Hand-painted" } },
    { scope: "painting-style", code: "interpret", label: { ar: "معالجة فنية بلمسة ربيع", en: "Artistic interpretation" } },
  ],
  orientation: [
    { scope: "orientation", code: "portrait", label: { ar: "طولي", en: "Portrait" } },
    { scope: "orientation", code: "landscape", label: { ar: "عرضي", en: "Landscape" } },
    { scope: "orientation", code: "square", label: { ar: "مربع", en: "Square" } },
  ],
  "shirt-type": [
    { scope: "shirt-type", code: "classic", label: { ar: "قصة كلاسيكية", en: "Classic fit" } },
    { scope: "shirt-type", code: "oversized", label: { ar: "قصة واسعة", en: "Oversized" } },
    { scope: "shirt-type", code: "longsleeve", label: { ar: "كم طويل", en: "Long sleeve" } },
    { scope: "shirt-type", code: "hoodie", label: { ar: "هودي", en: "Hoodie" } },
  ],
};

export const FALLBACK_ACTIVE_OPTIONS: CatalogActiveOptions = {
  shirtSizes: ["XS", "S", "M", "L", "XL", "XXL"].map(
    (code): CatalogSizeOption => ({ code, label: { ar: code, en: code } }),
  ),
  paintingSizes: [
    { code: "A5", label: { ar: "A5", en: "A5" } },
    { code: "A4", label: { ar: "A4", en: "A4" } },
    { code: "A3", label: { ar: "A3", en: "A3" } },
    { code: "custom", label: { ar: "مقاس خاص", en: "Custom size" } },
  ],
  colors: [
    { code: "sand", name: { ar: "رملي", en: "Sand" }, hex: "#E6D8BF" },
    { code: "cream", name: { ar: "كريمي", en: "Cream" }, hex: "#F2EADA" },
    { code: "ink", name: { ar: "حبري", en: "Ink" }, hex: "#2A2620" },
    { code: "clay", name: { ar: "طيني", en: "Clay" }, hex: "#B7472A" },
    { code: "olive", name: { ar: "زيتوني", en: "Olive" }, hex: "#5C6B4D" },
    { code: "teal", name: { ar: "بترولي", en: "Teal" }, hex: "#33605A" },
    { code: "rose", name: { ar: "وردي مغبر", en: "Dusty rose" }, hex: "#C89A8E" },
  ],
  frames: [
    { code: "none", label: { ar: "بدون إطار", en: "No frame" }, add: 0 },
    { code: "wood", label: { ar: "إطار خشب طبيعي", en: "Natural wood frame" }, add: 60 },
    { code: "black", label: { ar: "إطار معدني أسود", en: "Black metal frame" }, add: 80 },
  ],
  materials: [
    { code: "canvas", label: { ar: "قماش كانفس", en: "Canvas" } },
    { code: "paper", label: { ar: "ورق فني", en: "Fine-art paper" } },
    { code: "wood", label: { ar: "لوح خشبي", en: "Wood panel" } },
  ],
  methodsByScope: fallbackScopes,
};

/** The option lists the custom wizard actually renders, resolved per ProductionMethod scope. */
export type WizardOptions = {
  shirtTypes: CatalogMethodOption[];
  shirtSizes: CatalogSizeOption[];
  colors: CatalogColorOption[];
  methods: CatalogMethodOption[];
  placements: CatalogMethodOption[];
  paintingSizes: CatalogSizeOption[];
  orientations: CatalogMethodOption[];
  materials: CatalogMaterialOption[];
  paintStyles: CatalogMethodOption[];
};

function scopeOf(active: CatalogActiveOptions, scope: string): CatalogMethodOption[] {
  const list = active.methodsByScope[scope];
  return list && list.length > 0 ? list : fallbackScopes[scope];
}

/** Resolves live options into the wizard's shape, filling any empty list from the fallback. */
export function buildWizardOptions(active: CatalogActiveOptions | null): WizardOptions {
  const src = active ?? FALLBACK_ACTIVE_OPTIONS;
  return {
    shirtTypes: scopeOf(src, "shirt-type"),
    shirtSizes: src.shirtSizes.length > 0 ? src.shirtSizes : FALLBACK_ACTIVE_OPTIONS.shirtSizes,
    colors: src.colors.length > 0 ? src.colors : FALLBACK_ACTIVE_OPTIONS.colors,
    methods: scopeOf(src, "shirt-method"),
    placements: scopeOf(src, "placement"),
    paintingSizes: src.paintingSizes.length > 0 ? src.paintingSizes : FALLBACK_ACTIVE_OPTIONS.paintingSizes,
    orientations: scopeOf(src, "orientation"),
    materials: src.materials.length > 0 ? src.materials : FALLBACK_ACTIVE_OPTIONS.materials,
    paintStyles: scopeOf(src, "painting-style"),
  };
}

/** Code → localized-label lookup maps used by /order to render option summary lines. */
export type OptionLabelMaps = {
  colors: Record<string, LocalizedText>;
  /** Shirt + painting size codes merged (the code sets don't collide: XS–XXL vs A5/A4/A3/custom). */
  sizes: Record<string, LocalizedText>;
  frames: Record<string, LocalizedText>;
  materials: Record<string, LocalizedText>;
  shirtTypes: Record<string, LocalizedText>;
  methods: Record<string, LocalizedText>;
  placements: Record<string, LocalizedText>;
  orientations: Record<string, LocalizedText>;
  paintStyles: Record<string, LocalizedText>;
};

function toMap(entries: Array<{ code: string; label: LocalizedText }>): Record<string, LocalizedText> {
  return Object.fromEntries(entries.map((e) => [e.code, e.label]));
}

export function buildOptionLabelMaps(active: CatalogActiveOptions | null): OptionLabelMaps {
  const w = buildWizardOptions(active);
  const src = active ?? FALLBACK_ACTIVE_OPTIONS;
  const frames = src.frames.length > 0 ? src.frames : FALLBACK_ACTIVE_OPTIONS.frames;
  return {
    colors: Object.fromEntries(w.colors.map((c) => [c.code, c.name])),
    sizes: toMap([...w.shirtSizes, ...w.paintingSizes]),
    frames: toMap(frames),
    materials: toMap(w.materials),
    shirtTypes: toMap(w.shirtTypes),
    methods: toMap(w.methods),
    placements: toMap(w.placements),
    orientations: toMap(w.orientations),
    paintStyles: toMap(w.paintStyles),
  };
}
