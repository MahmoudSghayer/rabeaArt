"use client";

import { cx } from "@/lib/cx";
import styles from "./page.module.css";

export interface GalleryView {
  key: string;
  label: string;
  /** CSS background-size for this pseudo-zoom (e.g. "auto", "260% 260%"). */
  size: string;
  /** CSS background-position for this pseudo-zoom (e.g. "center", "22% 28%"). */
  pos: string;
}

export interface GalleryProps {
  isPaint: boolean;
  /** Full stage backdrop (grain + colour/paper gradient). */
  stageBackground: string;
  /** The product's placeholder-art gradient (grain + ARTS entry). */
  artBackground: string;
  /** Paintings: frame chrome around the art, driven by the selected frame option. */
  frameBorder: string;
  /** Shirts: print (solid) vs embroidery (dashed) border around the mockup. */
  printBorder: string;
  badge: { label: string; tone: "sale" | "ink" } | null;
  /** Shirts only — "Heavy cotton · {colour}" chip; null hides it. */
  fabricLabel: string | null;
  views: GalleryView[];
  activeView: number;
  onPickView: (index: number) => void;
  /** Accessible name for the art stage (the product name). */
  stageAlt: string;
}

/**
 * Product gallery: the big art stage (painting-in-frame or shirt-mockup presentation) plus the
 * three pseudo-view thumbnails from the design (Full piece / Texture detail / Brushwork — same
 * art gradient at different background-size/position zooms). Pure presentation; the parent
 * ProductView owns which view/colour/method/frame is selected. The design's pointer-tilt
 * effect is intentionally skipped.
 */
export function Gallery({
  isPaint,
  stageBackground,
  artBackground,
  frameBorder,
  printBorder,
  badge,
  fabricLabel,
  views,
  activeView,
  onPickView,
  stageAlt,
}: GalleryProps) {
  const zoom = views[activeView] ?? views[0];

  return (
    <div>
      <div
        className={styles.stage}
        style={{ backgroundImage: stageBackground }}
        role="img"
        aria-label={stageAlt}
      >
        <div className={styles.stageInner}>
          {isPaint ? (
            <div className={styles.paintFrame} style={{ border: frameBorder }}>
              <div
                className={styles.paintArt}
                style={{
                  backgroundImage: artBackground,
                  backgroundSize: zoom?.size,
                  backgroundPosition: zoom?.pos,
                }}
              />
            </div>
          ) : (
            <div className={styles.shirtMock} style={{ border: printBorder }}>
              <div
                className={styles.shirtArt}
                style={{
                  backgroundImage: artBackground,
                  backgroundSize: zoom?.size,
                  backgroundPosition: zoom?.pos,
                }}
              />
            </div>
          )}
        </div>
        {!isPaint && fabricLabel && <div className={styles.fabricChip}>{fabricLabel}</div>}
        {badge && (
          <span
            className={cx(
              styles.stageBadge,
              badge.tone === "sale" ? styles.badgeSale : styles.badgeInk,
            )}
          >
            {badge.label}
          </span>
        )}
      </div>

      <div className={styles.thumbs}>
        {views.map((v, i) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onPickView(i)}
            aria-pressed={i === activeView}
            className={cx(styles.thumb, i === activeView && styles.thumbActive)}
          >
            <div
              className={styles.thumbArt}
              style={{
                backgroundImage: artBackground,
                backgroundSize: v.size,
                backgroundPosition: v.pos,
              }}
              aria-hidden="true"
            />
            <div className={styles.thumbLabel}>{v.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
