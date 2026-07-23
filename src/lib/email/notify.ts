import "server-only";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";
import { getEmailProvider } from "./resend";
import { renderTemplate, type EmailLocale, type EmailTemplateData } from "./templates";
import type { EmailTemplate } from "./types";

/**
 * The single entry point other code should call to notify a customer of an order-lifecycle
 * event. Renders the template, sends it via the configured provider, and ALWAYS writes an
 * EmailLog row — sent or failed — so every notification attempt is auditable from Admin. Never
 * throws: a broken email pipeline must not fail (or roll back) the order-status change that
 * triggered it, so every failure is caught and logged instead of propagated.
 */
export async function sendOrderNotification(opts: {
  template: EmailTemplate;
  to: string;
  locale: EmailLocale;
  orderId?: string;
  data: EmailTemplateData;
}): Promise<void> {
  const { template, to, locale, orderId, data } = opts;

  try {
    const { subject, html, text } = renderTemplate(template, locale, data);
    const provider = getEmailProvider();
    const result = await provider.send({ to, subject, html, text });

    await prisma.emailLog.create({
      data: {
        orderId: orderId ?? null,
        to,
        template,
        status: result.ok ? "sent" : "failed",
        providerMessageId: result.ok ? result.id : null,
        error: result.ok ? null : result.error,
      },
    });
  } catch (err) {
    // `recipientEmail` (not the raw `to` string interpolated into a message) so the logger's
    // redaction catches the customer's address; the order id/template are the safe correlators.
    log.error("order notification send failed", {
      event: "order.email.send_failed",
      template,
      orderId: orderId ?? undefined,
      recipientEmail: to,
      error: err,
    });
    try {
      await prisma.emailLog.create({
        data: {
          orderId: orderId ?? null,
          to,
          template,
          status: "failed",
          error: err instanceof Error ? err.message : "UNKNOWN_ERROR",
        },
      });
    } catch (logErr) {
      log.error("order notification EmailLog write failed after send error", {
        event: "order.email.log_write_failed",
        template,
        orderId: orderId ?? undefined,
        error: logErr,
      });
    }
  }
}
