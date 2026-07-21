import { expect, test } from "@playwright/test";

/**
 * Mobile sweep at 390px.
 *
 * This file used to gate ALL of its checks behind E2E_HAS_DB, including three that never needed
 * a database — the hamburger nav and both overflow checks (the header comment even conceded the
 * hamburger one didn't). The result was that mobile had no CI coverage at all: every check was
 * skipped on every run.
 *
 * The DB-free checks now always run. Only the two that genuinely need a seeded catalogue — the
 * product grid and the sticky add-to-order bar — stay gated, in their own describe block.
 */

test.use({ viewport: { width: 390, height: 844 } });

test("hamburger opens the mobile nav", async ({ page }) => {
  await page.goto("/");
  const menuButton = page.getByRole("button", { name: /فتح القائمة|إغلاق القائمة/ });
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  // Scope to the header: the footer carries its own "المتجر" column link, so an unscoped
  // lookup resolves to two elements and dies on strict mode. The check is about the mobile
  // nav specifically, so the footer's copy is noise either way.
  const header = page.locator("header");
  await expect(header.getByRole("link", { name: "المتجر", exact: true })).toBeVisible();

  // And it must close again — a nav that opens but cannot be dismissed traps a phone user.
  await menuButton.click();
  await expect(header.getByRole("link", { name: "المتجر", exact: true })).toBeHidden();
});

/**
 * Horizontal overflow is the single most common mobile regression on this site — decorative
 * layers are deliberately oversized (glows on negative insets, marquee tracks wider than the
 * viewport, scaled reveals), and each one is a chance to widen the document. Cover every route,
 * not just two.
 */
const ROUTES = ["/", "/shop", "/custom", "/order", "/about", "/contact", "/legal/terms", "/legal/privacy"];

for (const route of ROUTES) {
  test(`no horizontal overflow on ${route}`, async ({ page }) => {
    await page.goto(route);

    // Scroll through: entrance transforms and sticky elements can only overflow once they run.
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < height; y += 600) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(600);

    const { scrollWidth, clientWidth, widest } = await page.evaluate(() => {
      const de = document.documentElement;
      // Name the widest offender, so a failure says WHAT overflowed rather than just by how much.
      let widest: string | null = null;
      let worst = 0;
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        const over = Math.max(r.right - de.clientWidth, -r.left);
        if (over > worst) {
          worst = over;
          widest = `${el.tagName}.${String((el as HTMLElement).className).slice(0, 50)}`;
        }
      }
      return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, widest };
    });

    expect(scrollWidth, `overflowed by ${scrollWidth - clientWidth}px; widest: ${widest}`).toBeLessThanOrEqual(
      clientWidth + 1,
    );
  });
}

test("the marquee ribbon never widens the page", async ({ page }) => {
  await page.goto("/");
  // Its tracks are intentionally wider than the viewport, so the band must contain them.
  const trackWidth = await page
    .locator("[class*='track']")
    .first()
    .evaluate((el) => el.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(trackWidth).toBeGreaterThan(clientWidth);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

/**
 * These two need a seeded catalogue: without one, /shop renders its empty state and there is no
 * product card to click through to.
 */
test.describe("with a seeded catalogue", () => {
  test.skip(!process.env.E2E_HAS_DB, "requires a seeded database — set E2E_HAS_DB=1 to run");

  test("product grid is single/two-column at 390px", async ({ page }) => {
    await page.goto("/shop");
    const card = page.locator('a[href^="/product/"]').first();
    await expect(card).toBeVisible();

    /*
      Walk UP to the nearest ancestor that is actually a grid.

      The original version used `xpath=..`, assuming the link's parent was the grid. It is not —
      the real DOM is `grid > div.tilt (TiltCard) > a.card`, so it read the TiltCard wrapper,
      got `gridTemplateColumns: "none"`, split that to length 1, and passed unconditionally.
      This check never verified anything. Resolving the grid by its computed display survives
      any future wrapper being added or removed.
    */
    const columns = await card.evaluate((el) => {
      let node: HTMLElement | null = el.parentElement;
      while (node) {
        const cs = getComputedStyle(node);
        if (cs.display === "grid" || cs.display === "inline-grid") {
          return cs.gridTemplateColumns.split(/\s+/).filter(Boolean).length;
        }
        node = node.parentElement;
      }
      return null;
    });

    expect(columns, "no grid ancestor found above the product card").not.toBeNull();
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
});
