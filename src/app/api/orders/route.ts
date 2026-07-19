import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { orderPayloadSchema } from "@/lib/orders/schemas";
import { SubmitError, submitOrder } from "@/lib/orders/submit";
import { sendOrderNotification } from "@/lib/email/notify";
import { getSettings } from "@/lib/catalog/queries";
import { prisma } from "@/lib/prisma";

/** Talks to Prisma (order transaction, rate-limit bucket) — must not run on the Edge runtime. */
export const runtime = "nodejs";

/** Best-effort client IP for rate-limit keying; falls back to a shared bucket if unavailable
 * (fails toward "rate limited together" rather than "unlimited"). Mirrors /api/uploads/sign. */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rateLimit = await checkRateLimit({ key: `order-submit:${ip}`, limit: 5, windowSeconds: 600 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    // A malformed body (bad JSON, or not JSON at all) collapses to `null`, which then fails
    // schema validation below with an ordinary 400 — no need for a separate "bad JSON" branch.
    const json = await request.json().catch(() => null);
    const parsed = orderPayloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          // Field paths + messages only — never the raw zod issue (no internal codes/expected
          // values leak to the client).
          issues: parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        },
        { status: 400 },
      );
    }

    const result = await submitOrder(parsed.data);

    // Confirmation email — fire-and-forget: sendOrderNotification never throws and logs every
    // attempt to EmailLog, and a mail failure must never turn a successfully stored order into
    // an error response.
    void (async () => {
      try {
        const order = await prisma.order.findUnique({
          where: { ref: result.ref },
          select: { id: true },
        });
        const settings = await getSettings();
        await sendOrderNotification({
          template: "order-received",
          to: parsed.data.customer.email,
          locale: parsed.data.locale,
          orderId: order?.id,
          data: {
            customerName: parsed.data.customer.name,
            orderRef: result.ref,
            estTotal: result.estTotal,
            whatsapp: settings.whatsapp,
          },
        });
      } catch (emailErr) {
        console.error("order-received email dispatch failed", emailErr);
      }
    })();

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof SubmitError) {
      return NextResponse.json({ code: err.code }, { status: 422 });
    }
    console.error("POST /api/orders failed", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
