import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./Scene3D.module.css";

export interface Scene3DProps {
  children: ReactNode;
  /**
   * Viewing distance in px. Lower = wider angle = more dramatic foreshortening. 900 matches the
   * perspective already used by useTilt, so a tilting card inside a scene agrees with its stage.
   */
  perspective?: number;
  className?: string;
}

/**
 * A shared perspective stage.
 *
 * This is the project's answer to "premium 3D art direction" without shipping WebGL. Real depth
 * needs three things — a perspective origin, children at different Z, and light/blur that agree
 * with that ordering — and CSS gives all three for roughly nothing. React Three Fiber would cost
 * ~150KB and a GL context for one hero section, which is not a trade worth making on a storefront
 * that has to stay fast on mid-range Android.
 *
 * `transform-style: preserve-3d` is what makes children's translateZ real rather than flattened.
 * It has one hard constraint that is easy to trip over: any `overflow`, `filter`, `opacity` or
 * `mask` on the stage collapses the 3D context back to flat. Put those on the LAYERS instead.
 */
export function Scene3D({ children, perspective = 900, className }: Scene3DProps) {
  return (
    <div
      className={cx(styles.scene, className)}
      style={{ "--scene-perspective": `${perspective}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}

export interface SceneLayerProps {
  children: ReactNode;
  /**
   * Depth in px. Negative recedes, positive approaches. Keep within roughly ±120: past that,
   * perspective scaling grows faster than the layout can absorb and layers start clipping.
   */
  z?: number;
  /** Degrees of rotation about Z — the casual "pinned to a board" tilt. */
  rotate?: number;
  /**
   * Blur far layers to fake depth of field. Opt-in per layer: it is the single most convincing
   * depth cue and also the most expensive, so it should never be applied by default.
   */
  blur?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * One plane within a Scene3D.
 *
 * Distant layers are also dimmed slightly, because atmospheric haze is what stops "small" from
 * reading as merely "smaller" — without it the eye interprets a far layer as a nearby tiny one.
 */
export function SceneLayer({ children, z = 0, rotate = 0, blur = false, className, style }: SceneLayerProps) {
  return (
    <div
      className={cx(styles.layer, blur && z < 0 && styles.depthBlur, className)}
      style={
        {
          "--layer-z": `${z}px`,
          "--layer-rotate": `${rotate}deg`,
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
