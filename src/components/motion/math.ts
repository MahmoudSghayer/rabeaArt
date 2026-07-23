/**
 * Pure geometry for the motion layer, kept separate from the hooks so it can be unit-tested.
 * The hooks themselves are thin: listen, compute with these, write to the DOM in a frame.
 */

/** Parallax drift ceiling, in px, from the approved design ("انزياح parallax حتى 42px"). */
export const MAX_PARALLAX_SHIFT = 42;

export interface Offset {
  x: number;
  y: number;
}

/**
 * Pointer position → parallax offset for one layer.
 * Centre of the viewport yields {0,0}; each edge yields ±(depth × MAX_PARALLAX_SHIFT), so a
 * `depth` of 1 travels the full range and smaller depths read as further away.
 */
export function parallaxOffset(
  clientX: number,
  clientY: number,
  viewportWidth: number,
  viewportHeight: number,
  depth: number,
): Offset {
  if (viewportWidth <= 0 || viewportHeight <= 0) return { x: 0, y: 0 };
  return {
    x: (clientX / viewportWidth - 0.5) * depth * MAX_PARALLAX_SHIFT,
    y: (clientY / viewportHeight - 0.5) * depth * MAX_PARALLAX_SHIFT,
  };
}

/**
 * Pointer position over an element → a small "magnetic" pull toward the cursor.
 * The element leans toward the pointer by `strength` of the pointer's distance from the element
 * centre, capped at ±`max` px per axis. Centre yields {0,0}. Kept pure so the cap and the
 * degrade-to-zero on a zero-size rect are unit-tested rather than eyeballed.
 */
export function magneticOffset(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  strength: number,
  max: number,
): Offset {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const clamp = (v: number) => Math.max(-max, Math.min(max, v));
  return { x: clamp(dx * strength), y: clamp(dy * strength) };
}

export interface TiltAngles {
  rotateX: number;
  rotateY: number;
}

/**
 * Pointer position within an element → tilt angles, capped at ±`max` degrees.
 * `rotateX` is negated so moving the cursor down tips the top edge away from the viewer, which
 * is the direction that reads as "pushing" the card rather than peeling it.
 */
export function tiltAngles(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  max: number,
): TiltAngles {
  if (rect.width <= 0 || rect.height <= 0) return { rotateX: 0, rotateY: 0 };
  const px = (clientX - rect.left) / rect.width - 0.5;
  const py = (clientY - rect.top) / rect.height - 0.5;
  return { rotateX: -py * max, rotateY: px * max };
}
