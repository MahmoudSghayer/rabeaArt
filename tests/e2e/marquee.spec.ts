import { expect, test } from "@playwright/test";

/**
 * The craft ribbon on the homepage.
 *
 * Worth real coverage because its predecessor failed silently in two different ways at once: the
 * keyframe was scoped away by CSS Modules so it never moved, and under reduced motion the global
 * clamp parked it at translateX(-50%) — permanently scrolled into its own seam. Neither showed
 * up as an error anywhere.
 */

test("both rows scroll, in opposite directions, without stalling", async ({ page }) => {
  await page.goto("/");

  const tracks = page.locator("[class*='track']");
  await expect(tracks).toHaveCount(2);

  // The animation must actually be attached and running — not merely declared.
  const state = await tracks.first().evaluate((el) => {
    const a = el.getAnimations();
    return { count: a.length, playState: a[0]?.playState, name: (a[0] as CSSAnimation)?.animationName };
  });
  expect(state.count).toBeGreaterThan(0);
  expect(state.playState).toBe("running");

  // Drive the clock rather than waiting on wall time: deterministic, and immune to the
  // background-tab throttling that makes marquee tests flaky.
  const sample = async (n: number, atMs: number) =>
    tracks.nth(n).evaluate((el, ms) => {
      const a = el.getAnimations()[0];
      a.currentTime = ms;
      return new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
    }, atMs);

  const a0 = await sample(0, 0);
  const a1 = await sample(0, 8000);

  // Row A travels.
  expect(Math.abs(a1 - a0)).toBeGreaterThan(10);

  // Below 640px the ribbon deliberately runs a single row — two counter-scrolling rows in a
  // ~40px band is noise at phone width, and it halves the compositing cost. Only assert the
  // counter-rotation where both rows are actually shown.
  const secondRowShown = await page.locator("[class*='viewport']").nth(1).isVisible();
  if (secondRowShown) {
    const b0 = await sample(1, 0);
    const b1 = await sample(1, 8000);
    // Opposite signs are the whole point of the pairing.
    expect(Math.sign(a1 - a0)).not.toBe(Math.sign(b1 - b0));
  }
});

test("hovering the ribbon pauses it", async ({ page }) => {
  await page.goto("/");
  const ribbon = page.locator("[class*='ribbon']").first();
  const track = page.locator("[class*='track']").first();

  await expect(track).toHaveCSS("animation-play-state", "running");
  await ribbon.hover();
  await expect(track).toHaveCSS("animation-play-state", "paused");
});

test("the ribbon does not widen the page", async ({ page }) => {
  await page.goto("/");
  // The tracks are deliberately wider than the viewport; the band must contain them.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("phrases keep the document's direction inside the LTR-forced track", async ({ page }) => {
  await page.goto("/");
  // The track is forced dir="ltr" so translateX(-50%) means the same thing in both locales;
  // each phrase must get RTL back or Arabic shapes and orders wrongly.
  const track = page.locator("[class*='track']").first();
  await expect(track).toHaveAttribute("dir", "ltr");

  const phraseDir = await page
    .locator("[class*='track'] [class*='text']")
    .first()
    .evaluate((el) => getComputedStyle(el).direction);
  expect(phraseDir).toBe("rtl");
});

test("screen readers hear the phrase list once, not four times", async ({ page }) => {
  await page.goto("/");
  // Two rows x two copies = four recitations if the tracks are not hidden.
  const hidden = await page.locator("[class*='track']").evaluateAll((els) =>
    els.every((el) => el.getAttribute("aria-hidden") === "true"),
  );
  expect(hidden).toBe(true);

  // The meaning is carried once, by the labelled group.
  await expect(page.locator("[role='group'][aria-label]").first()).toBeVisible();
});

test("reduced motion gives a static wrapped list, not a frozen half-scrolled track", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const track = page.locator("[class*='track']").first();
  await expect(track).toHaveCSS("animation-name", "none");
  // Critically NOT translateX(-50%) — that is where the old global clamp left it.
  await expect(track).toHaveCSS("transform", "none");

  // The second row is dropped: a reversed duplicate means nothing once nothing moves. It stays
  // in the DOM (display:none), so assert on what is VISIBLE rather than on node count.
  await expect(page.locator("[class*='viewport']").first()).toBeVisible();
  await expect(page.locator("[class*='viewport']").nth(1)).toBeHidden();

  // And the phrases are actually readable.
  await expect(page.locator("[class*='track'] [class*='text']").first()).toBeVisible();
});
