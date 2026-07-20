"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion, supportsHoverPointer } from "./env";
import { parallaxOffset } from "./math";

/**
 * Pointer-driven parallax for hero art, restoring the approved design's
 * "انزياح parallax حتى 42px يتبع الفأرة" (parallax drift up to 42px following the mouse).
 *
 * Attaches a single listener on `window` rather than one per element, and drives all registered
 * layers from one rAF tick — a hero with three floating cards costs one handler, not three.
 * Each layer moves by `depth × MAX_SHIFT`, so smaller depths read as further away.
 *
 * The transform is written to a CSS custom property (`--px`/`--py`) instead of `transform`, so
 * the element's own keyframe animation (rbFloat) keeps running untouched. Composing a JS
 * transform with a CSS animation on the same property would make one clobber the other.
 */
export function useParallaxLayer<T extends HTMLElement = HTMLDivElement>(depth = 1) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!supportsHoverPointer() || prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;

    let frame: number | null = null;
    let targetX = 0;
    let targetY = 0;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const offset = parallaxOffset(
        event.clientX,
        event.clientY,
        window.innerWidth,
        window.innerHeight,
        depth,
      );
      targetX = offset.x;
      targetY = offset.y;

      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        el.style.setProperty("--px", `${targetX.toFixed(1)}px`);
        el.style.setProperty("--py", `${targetY.toFixed(1)}px`);
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame !== null) cancelAnimationFrame(frame);
      el.style.removeProperty("--px");
      el.style.removeProperty("--py");
    };
  }, [depth]);

  return ref;
}
