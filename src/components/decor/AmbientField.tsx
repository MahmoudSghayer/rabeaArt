import { cx } from "@/lib/cx";
import styles from "./AmbientField.module.css";

export type AmbientVariant = "motes" | "threads" | "wash";

export interface AmbientFieldProps {
  /** "motes" = drifting dust; "threads" = slow diagonal fibres; "wash" = breathing colour fields. */
  variant?: AmbientVariant;
  /** 0–1. Default 1; drop it where the field sits behind dense text. */
  intensity?: number;
  className?: string;
}

/**
 * A decorative background field — drifting motes, thread fibres, or slow colour washes.
 *
 * This is what stops large sections reading as dead space. It is a server component with no JS
 * at all: every particle is a CSS gradient on one of three composited layers, animated by
 * transform only. An equivalent canvas/rAF particle system would cost a main-thread loop for the
 * life of the page, which is not worth it for something the reader should never consciously see.
 *
 * Purely decorative: `aria-hidden`, `pointer-events: none`, and never a container for content.
 * Disabled wholesale on coarse pointers and under reduced motion — see the CSS.
 */
export function AmbientField({ variant = "motes", intensity = 1, className }: AmbientFieldProps) {
  return (
    <div
      aria-hidden="true"
      className={cx(styles.field, styles[variant], className)}
      style={{ opacity: Math.max(0, Math.min(1, intensity)) }}
    >
      <span className={styles.layerA} />
      <span className={styles.layerB} />
      <span className={styles.layerC} />
    </div>
  );
}
