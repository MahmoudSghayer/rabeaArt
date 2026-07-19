/**
 * Runs once when a new Next.js server instance boots (dev, `next start`, and most hosts'
 * production runtime) — fails fast with a clear message if infra-critical env vars are
 * missing, instead of letting the app come up half-broken. See src/lib/env.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertRequiredEnv } = await import("@/lib/env");
    assertRequiredEnv();
  }
}
