import "server-only";
import { prisma } from "@/lib/prisma";
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
    console.error(`sendOrderNotification: failed to send "${template}" to ${to}`, err);
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
      console.error("sendOrderNotification: failed to write EmailLog after send error", logErr);
    }
  }
}
