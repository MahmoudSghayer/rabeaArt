"use client";

import type { ReactNode } from "react";
import { useMagnetic, type MagneticOptions } from "./useMagnetic";
import styles from "./Magnetic.module.css";

export interface MagneticProps extends MagneticOptions {
  children: ReactNode;
  className?: string;
}

/**
 * Client wrapper that gives a server-rendered CTA a subtle magnetic pull toward the cursor.
 * Like TiltCard, it is presentational only — an inline-block span that adds no semantics and no
 * focus stop, so the interactive child (a <Link> or <button>) keeps its own behaviour and remains
 * the thing the keyboard and screen reader see.
 */
export function Magnetic({ children, className, ...options }: MagneticProps) {
  const { ref, onPointerMove, onPointerLeave } = useMagnetic<HTMLSpanElement>(options);

  return (
    <span
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={[styles.magnetic, className].filter(Boolean).join(" ")}
    >
      {children}
    </span>
  );
}
