import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // next-intl's ESM build does a bare `import "next/server"`, which Vite cannot resolve
      // through Next's export map outside a Next build. Pointing at the concrete file lets the
      // proxy (middleware) be unit-tested — see tests/unit/coming-soon-gate.test.ts.
      "next/server": path.resolve(__dirname, "./node_modules/next/server.js"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", "_design-reference/**"],
    server: {
      // Externalized deps bypass Vite's resolver (and so the "next/server" alias above), so
      // next-intl must be inlined for it to take effect.
      deps: { inline: ["next-intl"] },
    },
  },
});
