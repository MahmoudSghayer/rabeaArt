import { expect, test } from "@playwright/test";

/**
 * Header navigation + cart entry point. No database required: every destination page here
 * renders its designed empty/degraded state without a DB (see AGENTS.md), and the cart itself
 * is client-side (zustand + localStorage) so the empty-order state needs no server data either.
 */

const NAV_LINKS: Array<{ name: string; path: string }> = [
  { name: "المتجر", path: "/shop" },
  { name: "تصميم خاص", path: "/custom" },
  { name: "عن ربيع", path: "/about" },
  { name: "تواصل", path: "/contact" },
];

test.describe("header nav links resolve", () => {
  for (const { name, path } of NAV_LINKS) {
    test(`"${name}" link goes to ${path} and returns 200`, async ({ page }) => {
      await page.goto("/");
      const response = await Promise.all([
        page.waitForResponse((res) => res.url().endsWith(path) || new URL(res.url()).pathname === path),
        page.getByRole("link", { name, exact: true }).first().click(),
      ]).then(([res]) => res);
      expect(response.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });
  }
});

test.describe("order pill", () => {
  test("leads to /order", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /طلبي/ }).click();
    await expect(page).toHaveURL(/\/order$/);
  });
});

test.describe("empty cart", () => {
  test("shows the empty state with working shop/custom CTAs", async ({ page }) => {
    await page.goto("/order");

    await expect(page.getByText("طلبك فارغ بعد")).toBeVisible();

    // Scope to <main> — the header nav also has a "custom" link with the same label, so an
    // unscoped lookup would be ambiguous.
    const main = page.locator("main");
    const shopCta = main.getByRole("link", { name: "تصفّح المتجر" });
    const customCta = main.getByRole("link", { name: "تصميم خاص", exact: true });
    await expect(shopCta).toBeVisible();
    await expect(customCta).toBeVisible();

    await expect(shopCta).toHaveAttribute("href", /\/shop$/);
    await expect(customCta).toHaveAttribute("href", /\/custom$/);
  });
});
