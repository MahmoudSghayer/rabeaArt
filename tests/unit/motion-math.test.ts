import { describe, expect, it } from "vitest";
import {
  MAX_PARALLAX_SHIFT,
  magneticOffset,
  parallaxOffset,
  tiltAngles,
} from "@/components/motion/math";

const VIEWPORT = { w: 1000, h: 800 };

describe("parallaxOffset", () => {
  it("returns no drift at the exact centre of the viewport", () => {
    const o = parallaxOffset(VIEWPORT.w / 2, VIEWPORT.h / 2, VIEWPORT.w, VIEWPORT.h, 1);
    expect(o.x).toBe(0);
    expect(o.y).toBe(0);
  });

  it("reaches ±half the max shift at the viewport edges for depth 1", () => {
    // Normalisation is -0.5..0.5, so an edge is half of MAX_PARALLAX_SHIFT, not all of it.
    const left = parallaxOffset(0, VIEWPORT.h / 2, VIEWPORT.w, VIEWPORT.h, 1);
    const right = parallaxOffset(VIEWPORT.w, VIEWPORT.h / 2, VIEWPORT.w, VIEWPORT.h, 1);
    expect(left.x).toBeCloseTo(-MAX_PARALLAX_SHIFT / 2);
    expect(right.x).toBeCloseTo(MAX_PARALLAX_SHIFT / 2);
  });

  it("never exceeds the design's stated ceiling", () => {
    for (const [x, y] of [
      [0, 0],
      [VIEWPORT.w, VIEWPORT.h],
      [VIEWPORT.w, 0],
    ]) {
      const o = parallaxOffset(x, y, VIEWPORT.w, VIEWPORT.h, 1);
      expect(Math.abs(o.x)).toBeLessThanOrEqual(MAX_PARALLAX_SHIFT);
      expect(Math.abs(o.y)).toBeLessThanOrEqual(MAX_PARALLAX_SHIFT);
    }
  });

  it("scales linearly with depth, so shallower layers drift less", () => {
    const near = parallaxOffset(VIEWPORT.w, VIEWPORT.h / 2, VIEWPORT.w, VIEWPORT.h, 1);
    const far = parallaxOffset(VIEWPORT.w, VIEWPORT.h / 2, VIEWPORT.w, VIEWPORT.h, 0.25);
    expect(far.x).toBeCloseTo(near.x * 0.25);
    expect(Math.abs(far.x)).toBeLessThan(Math.abs(near.x));
  });

  it("degrades to zero rather than NaN when the viewport has no size", () => {
    // Guards against a divide-by-zero during SSR/first paint writing "NaNpx" into the DOM.
    expect(parallaxOffset(10, 10, 0, 0, 1)).toEqual({ x: 0, y: 0 });
  });
});

describe("tiltAngles", () => {
  const rect = { left: 100, top: 50, width: 200, height: 300 };
  const MAX = 6;

  it("is flat when the cursor is at the element's centre", () => {
    const a = tiltAngles(rect.left + rect.width / 2, rect.top + rect.height / 2, rect, MAX);
    expect(a.rotateX).toBe(-0);
    expect(a.rotateY).toBe(0);
  });

  it("caps at ±half the max at the element's edges", () => {
    const right = tiltAngles(rect.left + rect.width, rect.top + rect.height / 2, rect, MAX);
    expect(right.rotateY).toBeCloseTo(MAX / 2);
    const left = tiltAngles(rect.left, rect.top + rect.height / 2, rect, MAX);
    expect(left.rotateY).toBeCloseTo(-MAX / 2);
  });

  it("inverts the X axis so a downward cursor tips the top edge away", () => {
    const below = tiltAngles(rect.left + rect.width / 2, rect.top + rect.height, rect, MAX);
    expect(below.rotateX).toBeLessThan(0);
    const above = tiltAngles(rect.left + rect.width / 2, rect.top, rect, MAX);
    expect(above.rotateX).toBeGreaterThan(0);
  });

  it("never exceeds the configured maximum anywhere inside the element", () => {
    for (let x = rect.left; x <= rect.left + rect.width; x += 25) {
      for (let y = rect.top; y <= rect.top + rect.height; y += 25) {
        const a = tiltAngles(x, y, rect, MAX);
        expect(Math.abs(a.rotateX)).toBeLessThanOrEqual(MAX);
        expect(Math.abs(a.rotateY)).toBeLessThanOrEqual(MAX);
      }
    }
  });

  it("degrades to zero for a zero-sized rect", () => {
    expect(tiltAngles(5, 5, { left: 0, top: 0, width: 0, height: 0 }, MAX)).toEqual({
      rotateX: 0,
      rotateY: 0,
    });
  });
});

describe("magneticOffset", () => {
  const RECT = { left: 100, top: 100, width: 200, height: 80 };
  const centerX = RECT.left + RECT.width / 2; // 200
  const centerY = RECT.top + RECT.height / 2; // 140

  it("returns no pull at the element centre", () => {
    expect(magneticOffset(centerX, centerY, RECT, 0.35, 10)).toEqual({ x: 0, y: 0 });
  });

  it("pulls toward the pointer, proportional to distance from centre", () => {
    // 20px right of centre, strength 0.35 → 7px, under the cap.
    const o = magneticOffset(centerX + 20, centerY, RECT, 0.35, 10);
    expect(o.x).toBeCloseTo(7);
    expect(o.y).toBe(0);
  });

  it("follows the pointer's sign on both axes", () => {
    const o = magneticOffset(centerX - 20, centerY - 10, RECT, 0.5, 100);
    expect(o.x).toBeCloseTo(-10);
    expect(o.y).toBeCloseTo(-5);
  });

  it("caps the pull at ±max per axis", () => {
    const o = magneticOffset(centerX + 1000, centerY - 1000, RECT, 0.35, 10);
    expect(o.x).toBe(10);
    expect(o.y).toBe(-10);
  });

  it("degrades to zero for a zero-size rect", () => {
    expect(magneticOffset(50, 50, { left: 0, top: 0, width: 0, height: 0 }, 0.35, 10)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
