"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A boolean that flips true and resets itself after `ms` — the "✓ saved" / "✓ copied"
 * confirmation pattern used across the admin panels.
 *
 * Exists because the naive version (`setX(true); setTimeout(() => setX(false), 3000)`) leaves a
 * timer running against an unmounted component when the admin navigates away inside the window,
 * which the panels firing theirs from inside a startTransition can do easily. Most timer sites
 * in this codebase already pair a useRef handle with a clearTimeout on unmount; this packages
 * that so the confirmation case can't get it wrong again.
 */
export function useFlash(ms: number): [boolean, () => void, () => void] {
  const [on, setOn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flash = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOn(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setOn(false);
    }, ms);
  }, [ms]);

  /** Dismiss early — e.g. the user edits the field again before the window elapses. */
  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setOn(false);
  }, []);

  return [on, flash, clear];
}
