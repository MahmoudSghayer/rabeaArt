import { expect, test } from "@playwright/test";

/**
 * The /custom wizard chooser + shirt flow up to (but not including) file upload. No database
 * required: both `listActiveOptions()` and `getSettings()` degrade to the hardcoded fallback
 * option lists (see custom/fallback-options.ts) when the DB is unreachable, and
 * `customOtherEnabled` defaults to `true` on a failed settings read — so locally all three
 * chooser cards render. Uploads themselves need a real Supabase Storage bucket, so this spec
 * stops at the upload step and only asserts the client-side "at least one file" validation.
 */

test.describe("wizard chooser", () => {
  test("renders three type cards (shirt, painting, other) when custom-other is available", async ({ page }) => {
    await page.goto("/custom");
    // Type cards are <button> elements, not links.
    await expect(page.getByRole("button", { name: /قميص مخصص/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /لوحة مخصصة/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /طلب فني آخر/ })).toBeVisible();
  });
});

test.describe("shirt flow", () => {
  test("picking 'shirt' advances into the wizard at step 1 of the shirt flow's 4 steps", async ({ page }) => {
    await page.goto("/custom");
    await page.getByRole("button", { name: /قميص مخصص/ }).click();

    // Step bar shows exactly 4 steps for the shirt flow (Base / Method / Design / Review).
    const stepPills = page.locator("text=/^[1-4] · /");
    await expect(stepPills).toHaveCount(4);
    await expect(page.locator("text=/^1 · /")).toBeVisible();
  });

  test("validation blocks advancing past the upload step with no files attached", async ({ page }) => {
    await page.goto("/custom?type=shirt");

    // Step 0 (Base) has valid defaults — advance.
    await page.getByRole("button", { name: "التالي" }).click();
    // Step 1 (Method) also has a valid default method + placement — advance.
    await page.getByRole("button", { name: "التالي" }).click();
    // Now on step 2, the upload step, with 0 files staged.
    await expect(page.locator("text=/^3 · /")).toBeVisible();

    await page.getByRole("button", { name: "التالي" }).click();

    // Exclude Next's own always-present route announcer, which also has role="alert" and would
    // otherwise trigger a strict-mode violation.
    await expect(
      page.locator('[role="alert"]:not(#__next-route-announcer__)'),
    ).toContainText("ارفع صورة واحدة على الأقل");
    // Still on the upload step — the click did not advance.
    await expect(page.locator("text=/^3 · /")).toBeVisible();
  });
});
