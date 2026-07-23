"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { BrandLoader } from "./BrandLoader";
import styles from "./NavigationLoader.module.css";

/**
 * Client-side page-transition loader.
 *
 * The route-level [locale]/loading.tsx only paints when a navigation actually suspends. On the
 * storefront that mostly does NOT happen page-to-page: <Link> prefetches the destination, and
 * sibling pages share the (storefront) layout so React soft-navigates without re-suspending the
 * boundary. The result is an instant swap with no loading state — which is why the brand loader
 * was never seen when switching pages.
 *
 * This bridges that gap: it watches for the *start* of an internal navigation (a same-origin
 * link click, or back/forward) and shows the same BrandLoader until the URL commits — pathname
 * OR query string, so /shop?cat=shirts -> /shop?cat=paintings counts too. A short minimum
 * on-screen time keeps it a deliberate beat rather than a flicker, and it fades out as the new
 * page paints.
 *
 * loading.tsx still handles the very first (server-streamed) load; this handles every hop after.
 */

const MIN_VISIBLE_MS = 450; // keep it a beat, not a flash
const FADE_OUT_MS = 200; // must match --duration-sm used by the .exiting transition
const SAFETY_MS = 6000; // never get wedged if a nav never commits (blocked, same-page, etc.)

type Phase = "idle" | "active" | "exiting";

function NavigationLoaderInner() {
  const t = useTranslations("common");
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const [phase, setPhase] = useState<Phase>("idle");

  const activeRef = useRef(false);
  const startedAtRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  // Wind the loader down: hold until MIN_VISIBLE_MS has elapsed, fade, then unmount.
  const finish = useCallback(() => {
    if (!activeRef.current) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAtRef.current));
    clearTimers();
    timersRef.current.push(
      window.setTimeout(() => {
        // Release the guard as the exit begins so a fresh click mid-fade can preempt it.
        activeRef.current = false;
        setPhase("exiting");
        timersRef.current.push(window.setTimeout(() => setPhase("idle"), FADE_OUT_MS));
      }, wait),
    );
  }, [clearTimers]);

  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    startedAtRef.current = Date.now();
    clearTimers();
    setPhase("active");
    timersRef.current.push(window.setTimeout(finish, SAFETY_MS));
  }, [clearTimers, finish]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Left-click only, and never when a modifier means "open in new tab/window/download".
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a") as
        | HTMLAnchorElement
        | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.dataset.noLoader != null) return;
      const rel = anchor.getAttribute("rel");
      if (rel && rel.includes("external")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return; // external link
      // No route change (identical URL, or a pure #hash jump) → no loader.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      start();
    }

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", start);
      clearTimers();
    };
  }, [start, clearTimers]);

  // The URL committed — the new page is here. Ignore the initial mount.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (activeRef.current) finish();
  }, [pathname, search, finish]);

  if (phase === "idle") return null;

  return (
    <div className={cx(styles.wrap, phase === "exiting" && styles.exiting)}>
      <BrandLoader label={t("loading")} />
    </div>
  );
}

export function NavigationLoader() {
  // useSearchParams() requires a Suspense boundary; fallback={null} keeps it invisible until then.
  return (
    <Suspense fallback={null}>
      <NavigationLoaderInner />
    </Suspense>
  );
}
