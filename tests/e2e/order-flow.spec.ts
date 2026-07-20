import { expect, type Page } from "@playwright/test";
import { test } from "@playwright/test";

/**
 * DB-GATED: requires a seeded database with at least one in-stock, orderable SHIRT product.
 * Locally, /product/[slug] can't even be reached without a real slug (the shop page has no
 * products to link from — see shop-browse.spec.ts's header comment), so this whole flow needs
 * `E2E_HAS_DB=1` against a seeded environment. See src/lib/orders/ref.ts for the "RA-<n>" format
 * asserted below.
 */

test.skip(!process.env.E2E_HAS_DB, "requires a seeded database — set E2E_HAS_DB=1 to run");

/** Opens the first shirt product from the shop grid and returns to a settled state on its page. */
async function openFirstShirtProduct(page: Page) {
  await page.goto("/shop?cat=shirts");
  const card = page.locator('a[href^="/product/"]').first();
  await card.click();
  await expect(page.locator("h1")).toHaveCount(1);
}

test("adding a shirt to the order, submitting details, and reaching confirmation", async ({ page }) => {
  await openFirstShirtProduct(page);

  // Colour swatches are the only `aria-pressed` buttons that also carry a `title` (the color
  // name) — size/method Chips share `aria-pressed` but never `title`, so this scopes reliably.
  const swatches = page.locator("button[title][aria-pressed]");
  if ((await swatches.count()) > 1) {
    await swatches.nth(1).click();
  }

  // Method (print/embroidery) — pick "print" explicitly if the chip is present & enabled (a
  // shirt with only embroidery configured renders the print chip disabled — leave it alone then).
  const printChip = page.getByRole("button", { name: /طباعة/ }).first();
  if ((await printChip.isVisible().catch(() => false)) && (await printChip.isEnabled().catch(() => false))) {
    await printChip.click();
  }

  const addButton = page.getByRole("button", { name: "أضِف إلى الطلب" }).first();
  await expect(addButton).toBeEnabled();
  await addButton.click();

  // Cart badge on the header order pill increments to 1.
  await expect(page.getByRole("link", { name: /طلبي/ })).toContainText("1");

  await page.goto("/order");
  await expect(page.getByText("مراجعة الطلب")).toBeVisible();
  // One line item card is present, showing qty 1 (the "remove" link only renders per item card).
  await expect(page.getByRole("button", { name: "إزالة" }).first()).toBeVisible();
  await expect(page.getByText("عدد القطع")).toBeVisible();

  await page.getByRole("button", { name: "متابعة" }).click();
  await expect(page.getByText("بياناتك وعنوان التوصيل")).toBeVisible();

  await page.getByLabel("الاسم الكامل").fill("نور الخطيب");
  await page.getByLabel("رقم الهاتف").fill("0501234567");
  await page.getByLabel("البريد الإلكتروني").fill("nour.e2e@example.com");
  await page.getByLabel("الدولة").fill("فلسطين");
  await page.getByLabel("المدينة").fill("حيفا");
  await page.getByLabel("الشارع").fill("شارع الجبل 14");

  const submitButton = page.getByRole("button", { name: "أرسِل الطلب" });

  // Both consents are required — submitting without them must not advance past the form.
  await submitButton.click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("بياناتك وعنوان التوصيل")).toBeVisible();

  // Click the checkbox indicator (first child span) rather than the button's full text — the
  // terms consent's label text wraps <Link>s to /legal/terms and /legal/privacy, and clicking
  // those would navigate away instead of toggling the checkbox (see DetailsForm.tsx's
  // `stopPropagation` on those links).
  const termsConsentBtn = page.locator("button", { hasText: "أوافق على" });
  await termsConsentBtn.locator("span").first().click();
  const customConsentBtn = page.locator("button", { hasText: "أفهم أن القطع المخصصة" });
  await customConsentBtn.locator("span").first().click();

  await submitButton.click();

  await expect(page.getByText("استلمنا طلبك")).toBeVisible({ timeout: 15000 });
  const refText = await page.getByText(/^RA-\d+$/).first().textContent();
  expect(refText?.trim()).toMatch(/^RA-\d+$/);

  // Cart is cleared after a successful submit — a fresh visit to /order shows the empty state.
  await page.goto("/order");
  await expect(page.getByText("طلبك فارغ بعد")).toBeVisible();
});
