import { expect, test } from "@playwright/test";

/**
 * Admin auth gate. No database required: the coarse gate (src/proxy.ts) redirects unauthenticated
 * `/admin/**` page requests to `/admin/login` purely from "is there a Supabase session cookie" —
 * no Prisma read happens before that redirect. Likewise `requireRole()` in the export route
 * returns 401 the moment `getSession()` finds no session, before it ever touches the DB.
 */

const PROTECTED_PAGES = ["/admin/orders", "/admin/products", "/admin/users"];

test.describe("protected admin pages redirect to login when logged out", () => {
  for (const path of PROTECTED_PAGES) {
    test(`${path} ends on the login screen`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login(\?.*)?$/);
      await expect(page.getByRole("button", { name: /تسجيل الدخول/ })).toBeVisible();
    });
  }
});

test.describe("admin CSV export API", () => {
  test("GET /api/admin/orders/export returns 401 when logged out", async ({ request }) => {
    const response = await request.get("/api/admin/orders/export");
    expect(response.status()).toBe(401);
  });
});

test.describe("login form", () => {
  test("has accessibly-labeled email + password inputs and a submit button", async ({ page }) => {
    await page.goto("/admin/login");

    const email = page.getByLabel("البريد الإلكتروني");
    const password = page.getByLabel("كلمة المرور");
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await expect(email).toHaveAttribute("type", "email");
    await expect(password).toHaveAttribute("type", "password");

    const submit = page.getByRole("button", { name: "تسجيل الدخول" });
    await expect(submit).toBeVisible();
    await expect(submit).toHaveAttribute("type", "submit");
  });

  test("redirecting from a protected page preserves it as ?next= for after login", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/next=%2Fadmin%2Forders/);
  });
});
