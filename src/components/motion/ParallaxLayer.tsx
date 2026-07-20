"use client";

import type { ReactNode } from "react";
import { useParallaxLayer } from "./useParallax";
import styles from "./ParallaxLayer.module.css";

export interface ParallaxLayerProps {
  children: ReactNode;
  /** Larger = moves further with the pointer, reading as closer to the viewer. 0.2–1 is sane. */
  depth?: number;
  className?: string;
}

/**
 * Wraps hero art so it drifts with the pointer. The hook writes `--px`/`--py` custom properties
 * rather than `transform`, so any keyframe animation already running on the child (the design's
 * rbFloat drift) survives — this layer only supplies the offset.
 */
export function ParallaxLayer({ children, depth = 1, className }: ParallaxLayerProps) {
  const ref = useParallaxLayer<HTMLDivElement>(depth);

  return (
    <div ref={ref} className={[styles.layer, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
