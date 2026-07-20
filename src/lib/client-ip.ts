/**
 * Trusted client-IP resolution for rate-limit keying.
 *
 * The naive `x-forwarded-for.split(",")[0]` is attacker-controlled: XFF is a plain request
 * header, so a caller can send a fresh value per request and land in a fresh rate-limit bucket
 * every time — which makes every limit that keys off it effectively unlimited.
 *
 * The rule that makes XFF trustworthy is "only believe the hops your own proxy appended".
 * So:
 *   1. On Vercel, prefer `x-vercel-forwarded-for`. Vercel's edge sets this itself and strips any
 *      inbound copy, so it cannot be spoofed from outside.
 *   2. Still on Vercel, fall back to the LAST entry of `x-forwarded-for` — the hop nearest our
 *      proxy. Client-supplied values are prepended, so the last entry is the one Vercel wrote.
 *      (The naive version reads the first entry, i.e. exactly the attacker-controlled one.)
 *   3. Off Vercel there is no proxy we can vouch for, so XFF is ignored entirely and callers
 *      share one bucket. That fails toward "rate limited together" rather than "unlimited".
 *
 * Returning a shared constant rather than throwing keeps this a limiter concern, never an
 * availability one.
 */

/** Bucket used when no trustworthy per-client identity is available. Shared on purpose. */
export const SHARED_IP_BUCKET = "untrusted";

function isVercel(): boolean {
  return Boolean(process.env.VERCEL);
}

function firstNonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Resolve a rate-limit identity for the request. Never throws.
 *
 * @param headers - the incoming request headers (works with both `Request` and `NextRequest`).
 */
export function clientIp(headers: Headers): string {
  // 1. Vercel's own header — set by the edge, inbound copies stripped. Most trustworthy.
  const vercelIp = firstNonEmpty(headers.get("x-vercel-forwarded-for"));
  if (vercelIp) {
    // Defensive: if it ever arrives as a list, the last hop is still the proxy-written one.
    const hops = vercelIp.split(",");
    const last = firstNonEmpty(hops[hops.length - 1]);
    if (last) return last;
  }

  // 2. Behind our own known proxy, trust only the hop it appended.
  if (isVercel()) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      const hops = forwarded.split(",");
      const last = firstNonEmpty(hops[hops.length - 1]);
      if (last) return last;
    }
  }

  // 3. No proxy we can vouch for: refuse to trust the header at all.
  return SHARED_IP_BUCKET;
}
