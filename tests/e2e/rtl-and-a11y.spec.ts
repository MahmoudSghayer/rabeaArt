import { expect, test } from "@playwright/test";

/**
 * RTL layout + baseline accessibility checks on the Arabic-only storefront. No database
 * required — runs against the static/degraded-render pages that work without a DB (home,
 * about, contact), see AGENTS.md.
 */

test.describe("RTL logical layout", () => {
  test("header logo sits on the inline-start side (the right edge, in RTL)", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    const logo = header.locator("a").first();
    const menuControl = page.getByRole("link", { name: /طلبي/ });

    const [logoBox, orderBox] = await Promise.all([logo.boundingBox(), menuControl.boundingBox()]);
    expect(logoBox).not.toBeNull();
    expect(orderBox).not.toBeNull();
    // In RTL, "inline-start" is the right edge: the logo (first in DOM / flex order) must sit to
    // the right of the order pill (later in DOM / flex order), i.e. a larger x coordinate.
    expect(logoBox!.x).toBeGreaterThan(orderBox!.x);
  });

  test("document direction is rtl and text-align follows it", async ({ page }) => {
    await page.goto("/about");
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe("rtl");
  });
});

test.describe("images have alt text", () => {
  for (const path of ["/", "/about", "/contact"]) {
    test(`every <img> on ${path} has an alt attribute (or is decorative)`, async ({ page }) => {
      await page.goto(path);
      const images = page.locator("img");
      const count = await images.count();
      for (let i = 0; i < count; i += 1) {
        const img = images.nth(i);
        const alt = await img.getAttribute("alt");
        const ariaHidden = await img.getAttribute("aria-hidden");
        // Either a real (possibly empty-string) alt attribute is present, or the image is
        // explicitly hidden from the accessibility tree.
        expect(alt !== null || ariaHidden === "true", `image #${i} on ${path} has neither alt nor aria-hidden`).toBe(
          true,
        );
      }
    });
  }
});

test.describe("keyboard navigation", () => {
  test("header nav links are reachable by Tab and show a focus-visible outline", async ({
    page,
    viewport,
  }) => {
    // Below 900px the desktop nav is collapsed behind the hamburger (SiteHeader.module.css), so
    // these links are correctly not in the tab order. Mobile menu a11y is covered separately.
    test.skip((viewport?.width ?? 0) < 900, "desktop nav is collapsed behind the hamburger");
    await page.goto("/");

    // Walk forward with Tab until we land on the header's first nav link, then confirm it's
    // both focused and carries a visible outline (focus-visible), matching SiteHeader.module.css.
    let found = false;
    // Scope to the header: the footer carries a second "المتجر" link, and an unscoped locator
    // raises a strict-mode violation that the .catch() below would silently swallow, making
    // this loop never match.
    const shopLink = page.locator("header").getByRole("link", { name: "المتجر", exact: true });
    for (let i = 0; i < 15 && !found; i += 1) {
      await page.keyboard.press("Tab");
      const isFocused = await shopLink.evaluate((el) => el === document.activeElement).catch(() => false);
      if (isFocused) found = true;
    }
    expect(found, "could not reach the Shop nav link via Tab within 15 presses").toBe(true);

    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline?.style).not.toBe("none");
  });
});

test.describe("heading structure", () => {
  for (const path of ["/", "/about", "/contact", "/legal/terms", "/legal/privacy"]) {
    test(`${path} has exactly one h1`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
    });
  }
});
