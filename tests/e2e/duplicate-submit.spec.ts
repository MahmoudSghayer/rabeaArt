import { expect, type Page } from "@playwright/test";
import { test } from "@playwright/test";

/**
 * DB-GATED: requires a seeded database with at least one in-stock, orderable SHIRT product (same
 * requirement as order-flow.spec.ts). Verifies the idempotency-key contract in
 * src/lib/orders/submit.ts's `findExistingByIdempotencyKey` fast path: a retried POST /api/orders
 * with the same `idempotencyKey` must return the SAME order ref rather than creating a second
 * order — this is what makes a genuine double-click (or a network-blip resubmit) safe.
 */

test.skip(!process.env.E2E_HAS_DB, "requires a seeded database — set E2E_HAS_DB=1 to run");

async function addFirstShirtAndReachDetailsForm(page: Page) {
  await page.goto("/shop?cat=shirts");
  await page.locator('a[href^="/product/"]').first().click();
  await expect(page.locator("h1")).toHaveCount(1);

  const addButton = page.getByRole("button", { name: "أضِف إلى الطلب" }).first();
  await expect(addButton).toBeEnabled();
  await addButton.click();

  await page.goto("/order");
  await page.getByRole("button", { name: "متابعة" }).click();
  await expect(page.getByText("بياناتك وعنوان التوصيل")).toBeVisible();

  await page.getByLabel("الاسم الكامل").fill("سارة أحمد");
  await page.getByLabel("رقم الهاتف").fill("0509876543");
  await page.getByLabel("البريد الإلكتروني").fill(`sara.e2e.${Date.now()}@example.com`);
  await page.getByLabel("الدولة").fill("فلسطين");
  await page.getByLabel("المدينة").fill("رام الله");
  await page.getByLabel("الشارع").fill("شارع الإرسال 5");

  const termsConsentBtn = page.locator("button", { hasText: "أوافق على" });
  await termsConsentBtn.locator("span").first().click();
  const customConsentBtn = page.locator("button", { hasText: "أفهم أن القطع المخصصة" });
  await customConsentBtn.locator("span").first().click();
}

test("double-clicking submit produces exactly one order", async ({ page }) => {
  await addFirstShirtAndReachDetailsForm(page);

  const submitButton = page.getByRole("button", { name: "أرسِل الطلب" });

  // The form disables the submit button the instant `isSubmitting` flips true, and the whole
  // form unmounts (replaced by the confirmation screen) the instant the request succeeds — so a
  // rapid double-click can, at most, fire two clicks on an element that becomes non-interactive
  // (or disappears) between them. This IS the product's actual double-submit defense; assert it
  // holds by firing both clicks back-to-back and confirming exactly one confirmation lands.
  await Promise.all([submitButton.click(), submitButton.click({ force: true }).catch(() => {})]);

  await expect(page.getByText("استلمنا طلبك")).toBeVisible({ timeout: 15000 });
  const refLocators = page.getByText(/^RA-\d+$/);
  await expect(refLocators).toHaveCount(1);

  // The order is gone from the cart afterward — a second identical order was not silently queued.
  await page.goto("/order");
  await expect(page.getByText("طلبك فارغ بعد")).toBeVisible();
});

test("a retried POST /api/orders with the same idempotency key returns the same ref", async ({
  page,
  request,
}) => {
  let capturedPayload: unknown = null;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().endsWith("/api/orders") && !capturedPayload) {
      capturedPayload = req.postDataJSON();
    }
  });

  await addFirstShirtAndReachDetailsForm(page);
  await page.getByRole("button", { name: "أرسِل الطلب" }).click();
  await expect(page.getByText("استلمنا طلبك")).toBeVisible({ timeout: 15000 });

  const firstRefText = await page.getByText(/^RA-\d+$/).first().textContent();
  const firstRef = firstRefText?.trim();
  expect(firstRef).toMatch(/^RA-\d+$/);
  expect(capturedPayload).not.toBeNull();

  // Replay the EXACT same payload (same idempotencyKey) directly against the API.
  const replay = await request.post("/api/orders", { data: capturedPayload as Record<string, unknown> });
  expect(replay.status()).toBe(200);
  const replayBody = (await replay.json()) as { ref: string };
  expect(replayBody.ref).toBe(firstRef);
});
