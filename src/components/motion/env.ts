/**
 * Shared capability checks for the motion layer. Kept in one place so every effect makes the
 * same call about when movement is appropriate, and so the rules are easy to audit.
 */

/** True when the OS asks for reduced motion. Every decorative effect must honour this. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * True only for devices with a real hover-capable, precise pointer (mouse/trackpad).
 * Touch screens report no hover, so pointer-following effects there would either never run or
 * fire awkwardly on tap.
 */
export function supportsHoverPointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
