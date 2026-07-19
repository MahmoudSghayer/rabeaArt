/**
 * Abstract-art CSS-gradient placeholders, ported verbatim from the `ARTS` object and `GRAIN`
 * texture in `_design-reference/store.js`. This is the design's official placeholder art system
 * — used wherever a page needs to stand in for a product photo or portrait that doesn't exist
 * yet (no real photography / DB-backed product images in this batch).
 */
export const ARTS = {
  dawn: "radial-gradient(90% 70% at 20% 20%, #E3B65B 0%, rgba(227,182,91,0) 55%), radial-gradient(80% 80% at 82% 28%, #B7472A 0%, rgba(183,71,42,0) 58%), radial-gradient(110% 90% at 60% 95%, #33605A 0%, rgba(51,96,90,0) 55%), linear-gradient(160deg,#F3E6CB,#DDBE92)",
  wave: "radial-gradient(120% 60% at 50% 110%, #24504B 0%, rgba(36,80,75,0) 60%), radial-gradient(70% 55% at 22% 30%, #7FA8A0 0%, rgba(127,168,160,0) 60%), radial-gradient(60% 45% at 80% 18%, #E9DFC8 0%, rgba(233,223,200,0) 65%), linear-gradient(180deg,#CFE0DA,#5E8981)",
  letters: "radial-gradient(65% 55% at 75% 75%, #8F3018 0%, rgba(143,48,24,0) 60%), radial-gradient(55% 45% at 25% 25%, #2A2620 0%, rgba(42,38,32,0) 62%), linear-gradient(200deg,#EFE3CC,#D8C6A4)",
  garden: "radial-gradient(75% 60% at 30% 80%, #3E5C40 0%, rgba(62,92,64,0) 60%), radial-gradient(50% 40% at 78% 22%, #C99B3F 0%, rgba(201,155,63,0) 60%), radial-gradient(40% 35% at 60% 60%, #B7472A 0%, rgba(183,71,42,0) 55%), linear-gradient(160deg,#22302B,#3A4A3E)",
  poem: "radial-gradient(70% 55% at 70% 80%, #C89A8E 0%, rgba(200,154,142,0) 60%), radial-gradient(45% 40% at 25% 20%, #B7472A 0%, rgba(183,71,42,0) 55%), linear-gradient(180deg,#F6EEDD,#E8D3BF)",
  bird: "radial-gradient(60% 50% at 30% 30%, #33605A 0%, rgba(51,96,90,0) 60%), radial-gradient(45% 40% at 75% 65%, #E3B65B 0%, rgba(227,182,91,0) 58%), linear-gradient(200deg,#F0E8D6,#CBD5C8)",
  rivers: "radial-gradient(120% 55% at 50% 0%, #D9B26A 0%, rgba(217,178,106,0) 55%), radial-gradient(120% 55% at 50% 105%, #2E5550 0%, rgba(46,85,80,0) 60%), radial-gradient(35% 50% at 50% 55%, #8F3018 0%, rgba(143,48,24,0) 60%), linear-gradient(180deg,#EEDFC2,#9FB4A8)",
  still: "radial-gradient(80% 65% at 70% 30%, #EDE3CF 0%, rgba(237,227,207,0) 60%), radial-gradient(55% 45% at 25% 75%, #A8B7AE 0%, rgba(168,183,174,0) 60%), linear-gradient(190deg,#E9E2D2,#C5CEC2)",
  city: "radial-gradient(50% 42% at 68% 28%, #C99B3F 0%, rgba(201,155,63,0) 58%), radial-gradient(70% 55% at 30% 78%, #4A443A 0%, rgba(74,68,58,0) 62%), linear-gradient(170deg,#EFE6D2,#B9A98C)",
  saffron: "radial-gradient(75% 60% at 30% 25%, #E3B65B 0%, rgba(227,182,91,0) 58%), radial-gradient(60% 55% at 78% 72%, #B7472A 0%, rgba(183,71,42,0) 60%), radial-gradient(30% 30% at 55% 45%, #8F3018 0%, rgba(143,48,24,0) 55%), linear-gradient(180deg,#F6EBD2,#E2C08F)",
  sea: "radial-gradient(90% 60% at 50% 100%, #24504B 0%, rgba(36,80,75,0) 62%), radial-gradient(55% 45% at 30% 25%, #E9DFC8 0%, rgba(233,223,200,0) 60%), radial-gradient(40% 35% at 78% 35%, #7FA8A0 0%, rgba(127,168,160,0) 58%), linear-gradient(180deg,#DCE5DA,#6E948B)",
  letter: "radial-gradient(60% 50% at 72% 70%, #C89A8E 0%, rgba(200,154,142,0) 58%), radial-gradient(50% 40% at 25% 30%, #4A443A 0%, rgba(74,68,58,0) 60%), linear-gradient(185deg,#F2E9D8,#D9C4AC)",
  custom: "radial-gradient(60% 50% at 30% 30%, #B7472A 0%, rgba(183,71,42,0) 55%), radial-gradient(50% 45% at 75% 70%, #33605A 0%, rgba(51,96,90,0) 58%), linear-gradient(170deg,#F3EADA,#DECDAF)",
} as const satisfies Record<string, string>;

export type ArtKey = keyof typeof ARTS;

/** Subtle noise-grain overlay, layered on top of an ARTS gradient for a paper-like texture. */
export const GRAIN =
  "url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22140%22 height=%22140%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/><feColorMatrix type=%22saturate%22 values=%220%22/></filter><rect width=%22140%22 height=%22140%22 filter=%22url(%23n)%22 opacity=%220.05%22/></svg>')";

/** Combines an ARTS gradient with the grain texture, matching the design's product-card art. */
export function grainedArt(key: ArtKey): string {
  return `${GRAIN}, ${ARTS[key]}`;
}
