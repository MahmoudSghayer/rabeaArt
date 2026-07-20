import { expect, test } from "@playwright/test";

/**
 * DB-GATED: the hamburger-menu check alone doesn't need a database, but the product-grid and
 * sticky-add-bar checks in this same file do (a real shop listing / product page — see
 * shop-browse.spec.ts and order-flow.spec.ts's header comments for why those degrade to empty
 * states locally). Gating the whole file keeps all four checks together as one "mobile" sweep,
 * per the task plan.
 */

test.skip(!process.env.E2E_HAS_DB, "requires a seeded database — set E2E_HAS_DB=1 to run");

test.use({ viewport: { width: 390, height: 844 } });

test("hamburger opens the mobile nav", async ({ page }) => {
  await page.goto("/");
  const menuButton = page.getByRole("button", { name: /فتح القائمة|إغلاق القائمة/ });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("link", { name: "المتجر", exact: true })).toBeVisible();
});

test("product grid is single/two-column at 390px", async ({ page }) => {
  await page.goto("/shop");
  const grid = page.locator('a[href^="/product/"]').first().locator("xpath=..");
  await expect(page.locator('a[href^="/product/"]').first()).toBeVisible();
  const columns = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(columns).toBeLessThanOrEqual(2);
});

test("sticky add-to-order bar appears on a product page", async ({ page }) => {
  await page.goto("/shop?cat=shirts");
  await page.locator('a[href^="/product/"]').first().click();
  await expect(page.locator("h1")).toHaveCount(1);

  const stickyAddButtons = page.getByRole("button", { name: "أضِف إلى الطلب" });
  // Two "add to order" buttons exist in the DOM (the panel one + the sticky mobile bar one) —
  // the sticky bar's copy must be visible in the viewport at mobile width.
  await expect(stickyAddButtons.last()).toBeVisible();
});

test("no horizontal overflow on the home page", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(true);
});

test("no horizontal overflow on the shop page", async ({ page }) => {
  await page.goto("/shop");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(true);
});
