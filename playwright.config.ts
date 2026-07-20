import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    // Pixel 7 (Chromium), not iPhone (WebKit): we test responsive layout and RTL behaviour,
    // not engine differences, and keeping both projects on Chromium means CI installs one
    // browser instead of two. Swap to an iPhone device if Safari-specific bugs ever matter.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // This runs a PRODUCTION build, which is exactly where the pre-launch gate in
      // src/proxy.ts is active — without this every request rewrites to /coming-soon and
      // the whole suite asserts against the holding page. Turning it off here tests the
      // real site; the gate itself is covered in tests/unit/coming-soon-gate.test.ts, which
      // drives src/proxy.ts directly (it is a pure function of request + env, so exercising it
      // here would mean a second production build on a second port for no extra fidelity).
      COMING_SOON: "0",
    },
  },
});
