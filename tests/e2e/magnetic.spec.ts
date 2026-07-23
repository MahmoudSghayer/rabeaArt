import { expect, test } from "@playwright/test";

/** The px the hook wrote — read from inline style, so it is the undiluted target, not a
 *  mid-transition sample. Returns {x, y}. */
async function inlineOffset(locator: import("@playwright/test").Locator): Promise<{ x: number; y: number }> {
  return locator.evaluate((el) => {
    const t = (el as HTMLElement).style.transform;
    const m = t.match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);
    return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
  });
}

test("hero CTA leans toward the pointer, bounded, and returns to rest", async ({ page }, testInfo) => {
  // The pull is gated on a fine hover pointer, so it is intentionally inert on the touch
  // (mobile) project — covered separately below.
  test.skip(testInfo.project.name === "mobile", "no fine hover pointer on the touch project");

  await page.goto("/");
  const magnetic = page.locator("[class*='magnetic']").first();
  await expect(magnetic).toBeVisible();

  const box = (await magnetic.boundingBox())!;
  const cy = box.y + box.height / 2;

  // Enter, then move to the far inline edge — the same sequence a real pointer performs.
  await page.mouse.move(box.x + 5, cy);
  await page.mouse.move(box.x + box.width - 3, cy);
  await page.waitForTimeout(80);

  const pulled = await inlineOffset(magnetic);
  expect(Math.abs(pulled.x), "CTA shifts toward the pointer").toBeGreaterThan(1);
  expect(Math.abs(pulled.x), "pull stays within the ±10px cap").toBeLessThanOrEqual(10.01);

  // Leave → the hook clears its inline transform so CSS eases it home.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 200);
  await page.waitForTimeout(120);
  expect(await magnetic.evaluate((el) => (el as HTMLElement).style.transform)).toBe("");
});

test("the magnetic wrapper adds no focus stop", async ({ page }) => {
  await page.goto("/");
  const magnetic = page.locator("[class*='magnetic']").first();
  expect(await magnetic.getAttribute("tabindex")).toBeNull();
  await expect(magnetic.locator("a")).toHaveCount(1);
});

test("touch devices get no pull", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "asserts the touch-project behaviour");
  await page.goto("/");
  const magnetic = page.locator("[class*='magnetic']").first();
  const box = (await magnetic.boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2);
  await page.waitForTimeout(120);
  expect((await inlineOffset(magnetic)).x).toBe(0);
});

test("reduced motion disables the pull", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const magnetic = page.locator("[class*='magnetic']").first();
  const box = (await magnetic.boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2);
  await page.waitForTimeout(120);
  expect((await inlineOffset(magnetic)).x).toBe(0);
});
