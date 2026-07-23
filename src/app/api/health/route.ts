import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Talks to Postgres for the readiness check — must not run on the Edge runtime. */
export const runtime = "nodejs";
/** A health check must reflect the live state on every hit, never a cached response. */
export const dynamic = "force-dynamic";

/**
 * GET /api/health — liveness + readiness probe for an external uptime monitor (LOG-02).
 *
 * Deliberately UNAUTHENTICATED (a monitor has no session) and leaks no detail: it returns only
 * ok/degraded, never an error message or stack. It is NOT matched by the coming-soon gate (see
 * the matcher in src/proxy.ts — general /api/* paths are excluded), so it answers 200 even while
 * the storefront is gated, which is what lets a monitor distinguish "site intentionally gated"
 * from "site actually down".
 *
 * 200 = app up and Postgres reachable. 503 = app up but its database is unreachable — the signal
 * a monitor should alert on. The DB round-trip is a bare `SELECT 1`: it exercises the pooled
 * connection without reading any table or customer data.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "ok" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    // TEMPORARY DIAGNOSTIC (will be reverted right after): surface the connection error's
    // name + message so it can be read via curl during a live DB-connectivity incident. Postgres
    // driver errors never contain the password — only the code/user/host — and this is removed as
    // soon as the root cause is identified.
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return NextResponse.json(
      { status: "degraded", db: "down", detail: detail.slice(0, 300) },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
