import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

/**
 * The pre-launch gate is the single mechanism standing between an unfinished site and the public
 * internet, and it was completely untested — playwright.config.ts even claimed otherwise. Its
 * failure modes are both expensive: "site stays dark on launch day" and "site opens early".
 *
 * Tested here rather than in Playwright because the gate is a pure function of (request, env):
 * the E2E suite runs its server with COMING_SOON=0 precisely so the gate is OFF, so covering it
 * there would need a second production build on a second port for no extra fidelity.
 */

function request(path: string, init?: { cookie?: string }): NextRequest {
  const headers = new Headers();
  if (init?.cookie) headers.set("cookie", init.cookie);
  return new NextRequest(new URL(path, "https://www.rabea.art"), { headers });
}

/** Where did the middleware internally rewrite to, if anywhere. */
function rewriteTarget(response: Response): string | null {
  return response.headers.get("x-middleware-rewrite");
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("COMING_SOON", "");
  vi.stubEnv("PREVIEW_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("gate ON (production, COMING_SOON unset)", () => {
  it("rewrites the storefront home to /coming-soon", async () => {
    const response = await proxy(request("/"));
    expect(rewriteTarget(response)).toContain("/coming-soon");
  });

  it("rewrites the admin login — the back office must not leak pre-launch either", async () => {
    const response = await proxy(request("/admin/login"));
    expect(rewriteTarget(response)).toContain("/coming-soon");
  });

  it("serves /coming-soon itself without rewriting (no redirect loop)", async () => {
    const response = await proxy(request("/coming-soon"));
    expect(rewriteTarget(response)).toBeNull();
  });

  /**
   * The regression this suite exists for: /api was excluded from the matcher, so while every
   * page said "coming soon", POST /api/orders was live to the internet and would write rows
   * into the production orders/customers tables.
   */
  it("refuses public API routes with 503, not an HTML rewrite", async () => {
    for (const path of ["/api/orders", "/api/uploads/sign", "/api/uploads/verify"]) {
      const response = await proxy(request(path));
      expect(response.status, path).toBe(503);
      expect(await response.json()).toEqual({ error: "SERVICE_UNAVAILABLE" });
      expect(response.headers.get("retry-after"), path).toBe("3600");
    }
  });

  it("leaves admin API routes reachable so the back office works during preview", async () => {
    // These self-gate with requireRole(); blocking them here would break admin use pre-launch.
    const response = await proxy(request("/api/admin/orders/export"));
    expect(response.status).not.toBe(503);
  });
});

describe("gate OFF", () => {
  it("COMING_SOON=0 disables the gate on launch day, with no code change", async () => {
    vi.stubEnv("COMING_SOON", "0");
    const response = await proxy(request("/"));
    expect(rewriteTarget(response)).not.toContain("/coming-soon");
  });

  it("public API routes are live once the gate is off", async () => {
    vi.stubEnv("COMING_SOON", "0");
    const response = await proxy(request("/api/orders"));
    expect(response.status).not.toBe(503);
  });

  it("local development is never gated", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await proxy(request("/"));
    expect(rewriteTarget(response)).not.toContain("/coming-soon");
  });

  /** Only "0" disables it. A typo like COMING_SOON=false must fail CLOSED, not open the site. */
  it("fails closed on any value other than exactly '0'", async () => {
    for (const value of ["false", "no", "1", "off", " 0"]) {
      vi.stubEnv("COMING_SOON", value);
      const response = await proxy(request("/"));
      expect(rewriteTarget(response), `COMING_SOON=${value}`).toContain("/coming-soon");
    }
  });
});

describe("preview bypass", () => {
  const KEY = "s3cret-preview-key";

  beforeEach(() => {
    vi.stubEnv("PREVIEW_KEY", KEY);
  });

  it("redirects and sets a hardened cookie when the key matches", async () => {
    const response = await proxy(request(`/?preview=${KEY}`));
    expect(response.status).toBe(307);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("rabea_preview=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=lax");
  });

  it("strips the key from the redirect URL so it stays out of history and Referer", async () => {
    const response = await proxy(request(`/?preview=${KEY}`));
    expect(response.headers.get("location")).not.toContain("preview=");
  });

  it("lets a holder of the cookie through on later requests", async () => {
    const response = await proxy(request("/", { cookie: `rabea_preview=${KEY}` }));
    expect(rewriteTarget(response)).not.toContain("/coming-soon");
  });

  it("rejects a wrong key, a wrong cookie, and a prefix of the real key", async () => {
    const wrongKey = await proxy(request("/?preview=nope"));
    expect(rewriteTarget(wrongKey)).toContain("/coming-soon");

    const wrongCookie = await proxy(request("/", { cookie: "rabea_preview=nope" }));
    expect(rewriteTarget(wrongCookie)).toContain("/coming-soon");

    // Guards the constant-time compare: a matching prefix must not be accepted.
    const prefix = await proxy(request(`/?preview=${KEY.slice(0, -1)}`));
    expect(rewriteTarget(prefix)).toContain("/coming-soon");
  });

  it("ignores the preview param entirely when PREVIEW_KEY is not configured", async () => {
    vi.stubEnv("PREVIEW_KEY", "");
    const response = await proxy(request("/?preview=anything"));
    expect(rewriteTarget(response)).toContain("/coming-soon");
  });

  it("does not let the bypass reopen the public API for everyone else", async () => {
    const response = await proxy(request("/api/orders"));
    expect(response.status).toBe(503);
  });
});
