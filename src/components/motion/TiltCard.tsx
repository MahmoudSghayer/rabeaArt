"use client";

import type { ReactNode } from "react";
import { useTilt, type TiltOptions } from "./useTilt";
import styles from "./TiltCard.module.css";

export interface TiltCardProps extends TiltOptions {
  children: ReactNode;
  className?: string;
}

/**
 * Client wrapper that gives any server-rendered card the design's pointer-following 3D tilt.
 * Purely presentational: it adds no semantics of its own, so the interactive element (usually a
 * <Link>) stays the child and keeps its own focus and hover behaviour.
 */
export function TiltCard({ children, className, ...tilt }: TiltCardProps) {
  const { ref, onPointerMove, onPointerLeave } = useTilt<HTMLDivElement>(tilt);

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={[styles.tilt, className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}
