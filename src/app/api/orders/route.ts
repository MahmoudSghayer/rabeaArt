import { NextResponse, after, type NextRequest } from "next/server";
import { clientIp } from "@/lib/client-ip";
import { log, requestIdFrom } from "@/lib/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { orderPayloadSchema } from "@/lib/orders/schemas";
import { SubmitError, submitOrder } from "@/lib/orders/submit";
import { sendOrderNotification } from "@/lib/email/notify";
import { getSettings } from "@/lib/catalog/queries";
import { prisma } from "@/lib/prisma";

/** Talks to Prisma (order transaction, rate-limit bucket) — must not run on the Edge runtime. */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request.headers);
  try {
    const ip = clientIp(request.headers);
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

    // Confirmation email — deferred, not blocking: sendOrderNotification never throws and logs
    // every attempt to EmailLog, and a mail failure must never turn a successfully stored order
    // into an error response. `after()` (not a bare un-awaited promise) is required on Vercel:
    // it registers the work with the platform's `waitUntil`, so the serverless invocation stays
    // alive until the send AND its EmailLog write finish, instead of being frozen mid-flight.
    after(async () => {
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
        // The order IS stored — only the customer's confirmation is missing. Nobody finds out
        // unless this is alertable, so it carries the order ref for manual follow-up.
        log.error("order confirmation email failed — customer was not notified", {
          event: "order.email.failed",
          requestId,
          orderRef: result.ref,
          error: emailErr,
        });
      }
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof SubmitError) {
      return NextResponse.json({ code: err.code }, { status: 422 });
    }
    log.error("order submission failed", {
      event: "order.submit.failed",
      requestId,
      error: err,
    });
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
