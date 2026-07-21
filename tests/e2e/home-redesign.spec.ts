import { expect, test } from "@playwright/test";

/**
 * The redesigned homepage.
 *
 * The MaskReveal checks here exist because of a bug this suite failed to catch the first time:
 * the mask polarity was inverted, so `.shown` slid the mask to its HIDDEN position and every
 * category tile rendered as blank paper. The original test asserted the computed mask-position
 * reached a particular value — which it did — proving the mechanism ran but never that anything
 * was visible. The assertions below check the state that means REVEALED, and are pinned with the
 * values confirmed against a screenshot.
 */

/** Scroll gradually: an instant jump flashes sections past in one frame and the observer may not fire. */
async function scrollThrough(page: import("@playwright/test").Page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 400) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(900);
}

test("every revealed section ends up visible, not stuck behind its own mask", async ({ page }) => {
  await page.goto("/");
  await scrollThrough(page);

  // Poll rather than sample once: entrance transitions are ~0.9s and the observer fires
  // asynchronously, so a single read races the animation whenever the machine is loaded.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            Array.from(document.querySelectorAll("[class*='reveal'], [class*='wrap']")).filter(
              (el) => getComputedStyle(el).opacity === "0",
            ).length,
        ),
      { timeout: 10_000, message: "sections still at opacity 0 after scrolling past them" },
    )
    .toBe(0);

  // dir="up" reveals when the mask's OPAQUE half covers the element, i.e. Y at 100%.
  // If this ever reads "0px 0%" again, the tiles are invisible.
  const cell = page.locator("[class*='catCell']").first();
  await expect(cell).toHaveCSS("mask-position", "0px 100%", { timeout: 10_000 });
});

test("all three category tiles render with their artwork", async ({ page }) => {
  await page.goto("/");
  await page.locator("[class*='catGrid']").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);

  const tiles = page.locator("[class*='catTile']");
  await expect(tiles).toHaveCount(3);

  for (let i = 0; i < 3; i += 1) {
    const tile = tiles.nth(i);
    await expect(tile).toBeVisible();
    const box = await tile.boundingBox();
    expect(box!.height).toBeGreaterThan(200);
    expect(box!.width).toBeGreaterThan(100);
  }

  // The custom-order tile is the new one, and the reason the row balances at three.
  await expect(page.locator("a[href$='/custom'][class*='catTile']")).toHaveCount(1);
});

test("the ordering steps read as a connected process", async ({ page }) => {
  await page.goto("/");
  await page.locator("[class*='stepsGrid']").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);

  // An ordered list, because it is one — it was a stack of divs before.
  await expect(page.locator("ol[class*='stepsGrid']")).toHaveCount(1);
  const steps = page.locator("li[class*='stepCard']");
  await expect(steps).toHaveCount(4);

  // Each step carries its own ornament, so the cards are distinguishable by more than a numeral.
  const icons = page.locator("li[class*='stepCard'] svg[aria-hidden='true']");
  await expect(icons).toHaveCount(4);
});

test("the page holds its invariants after the redesign", async ({ page }) => {
  await page.goto("/");
  await scrollThrough(page);

  await expect(page.locator("h1")).toHaveCount(1);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // Decorative layers must not become focus stops.
  const decorFocusables = await page.evaluate(() => {
    let n = 0;
    for (const r of Array.from(document.querySelectorAll("[aria-hidden='true']"))) {
      n += r.querySelectorAll("a, button, input, select, textarea, [tabindex]").length;
    }
    return n;
  });
  expect(decorFocusables).toBe(0);
});

test("reduced motion shows the whole page with nothing masked away", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  // No scrolling: under reduced motion everything must be visible immediately, including
  // content far below the fold that no observer has reached.
  const hidden = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll("[class*='reveal'], [class*='wrap']")).filter((el) => {
        const cs = getComputedStyle(el);
        return cs.opacity === "0" || cs.maskImage !== "none";
      }).length,
  );
  expect(hidden).toBe(0);

  await expect(page.locator("[class*='catTile']").first()).toBeVisible();
  await expect(page.locator("li[class*='stepCard']").first()).toBeVisible();
});
