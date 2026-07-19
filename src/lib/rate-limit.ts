import { prisma } from "@/lib/prisma";

/**
 * Postgres-backed fixed-window rate limiter, keyed off the `RateLimitBucket` model (see
 * prisma/schema.prisma). Avoids adding a Redis/Upstash dependency for a low-traffic
 * storefront: order submission and auth endpoints are the only callers, and a single-row
 * upsert per check is cheap at this scale.
 *
 * Fails OPEN: if the DB query throws (transient connection issue, etc.), the request is
 * allowed through. Rate limiting is a defensive nicety here, not a security boundary — it must
 * never be the reason the storefront goes down.
 */
export async function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  const { key, limit, windowSeconds } = opts;
  try {
    const now = new Date();
    const existing = await prisma.rateLimitBucket.findUnique({ where: { key } });
    const windowExpired = !existing || now.getTime() - existing.windowFrom.getTime() >= windowSeconds * 1000;

    if (windowExpired) {
      await prisma.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, windowFrom: now },
        update: { count: 1, windowFrom: now },
      });
      return { allowed: 1 <= limit, remaining: Math.max(0, limit - 1) };
    }

    const updated = await prisma.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return { allowed: updated.count <= limit, remaining: Math.max(0, limit - updated.count) };
  } catch (err) {
    console.error("checkRateLimit: DB check failed, failing open", err);
    return { allowed: true, remaining: limit };
  }
}
