"use client";

import { useCallback, useEffect, useRef } from "react";
import { prefersReducedMotion, supportsHoverPointer } from "./env";
import { magneticOffset } from "./math";

export interface MagneticOptions {
  /** Fraction of the pointer's offset-from-centre the element follows. Subtle by design. */
  strength?: number;
  /** Hard cap on the pull, in px per axis. */
  max?: number;
}

/**
 * A subtle magnetic pull toward the cursor, for primary CTAs. The button leans a few pixels
 * toward the pointer while it is over it, then eases back on leave.
 *
 * Gated exactly like useTilt — fine pointer only (no hover state on touch) and off under
 * prefers-reduced-motion. It is a single cheap transform on one element, so it does not warrant
 * the heavier device-class gating the expensive multi-layer effects would. Writes only
 * `transform`, on a ref, inside requestAnimationFrame, so it never triggers a React render.
 */
export function useMagnetic<T extends HTMLElement = HTMLDivElement>(options: MagneticOptions = {}) {
  const { strength = 0.35, max = 10 } = options;
  const ref = useRef<T | null>(null);
  const frame = useRef<number | null>(null);
  const enabled = useRef(false);

  useEffect(() => {
    const compute = () => supportsHoverPointer() && !prefersReducedMotion();
    enabled.current = compute();

    // Honour a mid-session OS reduced-motion toggle, matching useTilt.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      enabled.current = compute();
      if (!enabled.current && ref.current) ref.current.style.transform = "";
    };
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<T>) => {
      if (!enabled.current || event.pointerType !== "mouse") return;
      const el = ref.current;
      if (!el) return;

      const { x, y } = magneticOffset(event.clientX, event.clientY, el.getBoundingClientRect(), strength, max);

      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      });
    },
    [strength, max],
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    // Clear the inline transform so the CSS transition eases it home.
    el.style.transform = "";
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
