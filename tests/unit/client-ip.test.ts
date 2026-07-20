import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SHARED_IP_BUCKET, clientIp } from "@/lib/client-ip";

/**
 * These tests encode the actual threat: every rate limit in the app keys off this function, so
 * if a caller can choose its return value, they can choose a fresh bucket per request and the
 * limits become decorative.
 */

const originalVercel = process.env.VERCEL;

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

beforeEach(() => {
  process.env.VERCEL = "1";
});

afterEach(() => {
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
});

describe("on Vercel", () => {
  it("prefers x-vercel-forwarded-for, which the edge sets and inbound copies cannot forge", () => {
    expect(clientIp(headers({ "x-vercel-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("ignores a spoofed x-forwarded-for when the Vercel header is present", () => {
    const h = headers({
      "x-forwarded-for": "1.2.3.4",
      "x-vercel-forwarded-for": "203.0.113.7",
    });
    expect(clientIp(h)).toBe("203.0.113.7");
  });

  it("takes the LAST x-forwarded-for hop — the one our proxy appended", () => {
    // A caller sends "9.9.9.9"; Vercel appends the true client. The old implementation read
    // index 0 and returned the attacker's value.
    expect(clientIp(headers({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("gives an attacker no control by varying the prefix", () => {
    const a = clientIp(headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" }));
    const b = clientIp(headers({ "x-forwarded-for": "2.2.2.2, 203.0.113.7" }));
    // Same real client → same bucket, regardless of what they prepend.
    expect(a).toBe(b);
  });

  it("trims whitespace around hops", () => {
    expect(clientIp(headers({ "x-forwarded-for": "9.9.9.9,   203.0.113.7  " }))).toBe("203.0.113.7");
  });

  it("falls back to the shared bucket when no forwarding header exists", () => {
    expect(clientIp(headers({}))).toBe(SHARED_IP_BUCKET);
  });

  it("ignores an empty or whitespace-only header rather than returning a blank key", () => {
    expect(clientIp(headers({ "x-forwarded-for": "   " }))).toBe(SHARED_IP_BUCKET);
    expect(clientIp(headers({ "x-vercel-forwarded-for": "" }))).toBe(SHARED_IP_BUCKET);
  });
});

describe("off Vercel", () => {
  beforeEach(() => {
    delete process.env.VERCEL;
  });

  it("refuses to trust x-forwarded-for at all — there is no proxy we can vouch for", () => {
    expect(clientIp(headers({ "x-forwarded-for": "1.2.3.4" }))).toBe(SHARED_IP_BUCKET);
  });

  it("still honours the Vercel-specific header if something upstream set it", () => {
    expect(clientIp(headers({ "x-vercel-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("shares one bucket, i.e. fails toward limited-together rather than unlimited", () => {
    const a = clientIp(headers({ "x-forwarded-for": "1.1.1.1" }));
    const b = clientIp(headers({ "x-forwarded-for": "2.2.2.2" }));
    expect(a).toBe(b);
    expect(a).toBe(SHARED_IP_BUCKET);
  });
});
