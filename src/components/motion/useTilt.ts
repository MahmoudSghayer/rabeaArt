"use client";

import { useCallback, useEffect, useRef } from "react";
import { prefersReducedMotion, supportsHoverPointer } from "./env";
import { tiltAngles } from "./math";

export interface TiltOptions {
  /** Maximum rotation on each axis, in degrees. The approved design specifies ±6°. */
  max?: number;
  /** CSS perspective depth. Lower = more dramatic. */
  perspective?: number;
  /** Scale applied while hovering, for a subtle "lift toward the viewer". */
  scale?: number;
}

/**
 * Pointer-following 3D tilt, ported from the approved design's `tiltMove`/`tiltLeave` handlers
 * (see Home/Shop/Product .dc.html) which were dropped during the original port.
 *
 * Deliberate constraints:
 *  - Fine pointers only. On touch there is no hover state, so a tilt would either never fire or
 *    fire on tap and feel broken.
 *  - Disabled under `prefers-reduced-motion` — vestibular safety, and the StyleGuide requires it.
 *  - Writes only `transform`, on a ref, inside requestAnimationFrame. No React state per frame,
 *    so a grid of cards doesn't re-render on every mouse move.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(options: TiltOptions = {}) {
  const { max = 6, perspective = 900, scale = 1.02 } = options;
  const ref = useRef<T | null>(null);
  const frame = useRef<number | null>(null);
  const enabled = useRef(false);

  useEffect(() => {
    enabled.current = supportsHoverPointer() && !prefersReducedMotion();

    // Motion preference can change mid-session (OS toggle); keep up rather than caching forever.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      enabled.current = supportsHoverPointer() && !mq.matches;
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

      const { rotateX, rotateY } = tiltAngles(
        event.clientX,
        event.clientY,
        el.getBoundingClientRect(),
        max,
      );

      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        el.style.transform =
          `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) ` +
          `rotateY(${rotateY.toFixed(2)}deg) scale(${scale})`;
      });
    },
    [max, perspective, scale],
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    // Clearing the inline transform lets the element's CSS transition ease it back to rest.
    el.style.transform = "";
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
