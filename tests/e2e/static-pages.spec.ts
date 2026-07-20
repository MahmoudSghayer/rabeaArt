import { expect, test } from "@playwright/test";

/**
 * Static-content storefront pages — no database required. All five pages fetch nothing
 * DB-backed (see AGENTS.md: About/Contact/legal are pure translation content), so this spec runs
 * fully, locally and in CI, without E2E_HAS_DB.
 */

const PAGES = [
  { path: "/", name: "home" },
  { path: "/about", name: "about" },
  { path: "/contact", name: "contact" },
  { path: "/legal/terms", name: "legal/terms" },
  { path: "/legal/privacy", name: "legal/privacy" },
];

for (const { path, name } of PAGES) {
  test.describe(`static page: ${name} (${path})`, () => {
    test("returns 200 and renders exactly one h1", async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
    });

    test("<html> is Arabic RTL by default", async ({ page }) => {
      await page.goto(path);
      const html = page.locator("html");
      await expect(html).toHaveAttribute("lang", "ar");
      await expect(html).toHaveAttribute("dir", "rtl");
    });

    test("renders the shared header and footer", async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("header")).toBeVisible();
      const footer = page.locator("footer");
      await expect(footer).toBeVisible();
      await expect(footer).toContainText("devora.design");
    });

    test("has no console errors", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(errors, `console errors on ${path}: ${errors.join(" | ")}`).toEqual([]);
    });
  });
}

test.describe("footer devora.design credit", () => {
  test("links out to https://devora.design", async ({ page }) => {
    await page.goto("/");
    const credit = page.locator("footer a", { hasText: "devora.design" });
    await expect(credit).toHaveAttribute("href", "https://devora.design");
    await expect(credit).toHaveAttribute("target", "_blank");
  });
});
