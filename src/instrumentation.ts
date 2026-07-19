/**
 * Runs once when a new Next.js server instance boots (dev, `next start`, and most hosts'
 * production runtime) — fails fast with a clear message if infra-critical env vars are
 * missing, instead of letting the app come up half-broken. See src/lib/env.ts.
 */
export async function register() {
  // Skip during `next build` (static page-data collection boots this hook): CI/Vercel builds
  // must succeed without runtime secrets. The assert still guards every real server boot.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertRequiredEnv } = await import("@/lib/env");
    assertRequiredEnv();
  }
}
