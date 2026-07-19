/**
 * Bilingual copy + HTML rendering for order-notification emails.
 *
 * These strings deliberately live HERE, not in `src/messages/*` — `src/messages` is the
 * next-intl catalog for the UI (browser-rendered, locale-negotiated per request); this module is
 * server-only copy composed once into a fully-rendered HTML string and handed to the email
 * provider. Keeping them apart avoids coupling the email pipeline to the UI's i18n runtime.
 *
 * Copy is short and factual on purpose: the studio contacts customers personally for anything
 * that needs a conversation (final price, timing, custom-order specifics) — these emails are
 * notifications that something happened, not a marketing or negotiation channel.
 */

import type { EmailTemplate } from "./types";

export type EmailLocale = "ar" | "en";

export type EmailTemplateData = {
  customerName: string;
  orderRef: string;
  estTotal?: number | null;
  finalPrice?: number | null;
  whatsapp: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

/** Brand palette (see repo design reference): #F6F0E3 paper, #23201B ink, #B7472A sienna. */
const COLORS = {
  paper: "#F6F0E3",
  ink: "#23201B",
  sienna: "#B7472A",
} as const;

/** Matches the "₪" currency shown across the storefront UI (see src/messages/*.json `common.currency`). */
function formatAmount(amount: number, locale: EmailLocale): string {
  const formatted = amount.toLocaleString(locale === "ar" ? "ar" : "en", { maximumFractionDigits: 2 });
  return locale === "ar" ? `${formatted} ₪` : `₪${formatted}`;
}

/** Builds a `wa.me` link from a phone number in any common format (spaces, dashes, leading `+`). */
function whatsappLink(whatsapp: string): string {
  const digits = whatsapp.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

/** Shared inline-styled shell every template renders into — a simple branded card, table-based
 * for email-client compatibility, with a WhatsApp contact link in the footer (the studio's
 * primary channel for anything beyond this notification). */
function renderShell(opts: { locale: EmailLocale; title: string; paragraphHtml: string; whatsapp: string }): string {
  const { locale, title, paragraphHtml, whatsapp } = opts;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const contactLabel = locale === "ar" ? "تواصل عبر واتساب" : "Contact us on WhatsApp";

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
  <body style="margin:0;padding:0;background:${COLORS.paper};font-family:Arial,Helvetica,sans-serif;color:${COLORS.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paper};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:8px;overflow:hidden;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:${COLORS.sienna};padding:20px 24px;">
                <span style="color:${COLORS.paper};font-size:18px;font-weight:bold;">Rabea.art</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 12px;font-size:20px;color:${COLORS.ink};">${title}</h1>
                ${paragraphHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #eee;">
                <a href="${whatsappLink(whatsapp)}" style="color:${COLORS.sienna};text-decoration:none;font-size:14px;">${contactLabel}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

type TemplateCopy = {
  subject: (data: EmailTemplateData) => string;
  heading: string;
  paragraph: (data: EmailTemplateData) => string;
};

const COPY: Record<EmailTemplate, Record<EmailLocale, TemplateCopy>> = {
  "order-received": {
    en: {
      subject: (d) => `We received your order ${d.orderRef}`,
      heading: "Order received",
      paragraph: (d) =>
        `Hi ${d.customerName}, we received your order <strong>${d.orderRef}</strong>. Our team is reviewing it and will contact you within 24 working hours to confirm details, pricing, and delivery. No payment is needed yet.`,
    },
    ar: {
      subject: (d) => `استلمنا طلبك ${d.orderRef}`,
      heading: "تم استلام الطلب",
      paragraph: (d) =>
        `مرحبًا ${d.customerName}، استلمنا طلبك <strong>${d.orderRef}</strong>. فريقنا يراجعه الآن، وسنتواصل معك خلال 24 ساعة عمل لتأكيد التفاصيل والسعر والتوصيل. لا حاجة لأي دفع الآن.`,
    },
  },
  "quotation-sent": {
    en: {
      subject: (d) => `Quotation ready for order ${d.orderRef}`,
      heading: "Quotation sent",
      paragraph: (d) =>
        `Hi ${d.customerName}, we've reviewed order <strong>${d.orderRef}</strong>.${
          d.estTotal != null ? ` Estimated total: <strong>${formatAmount(d.estTotal, "en")}</strong>.` : ""
        } We'll reach out on WhatsApp or by phone to confirm the final price before any work starts.`,
    },
    ar: {
      subject: (d) => `عرض السعر جاهز لطلبك ${d.orderRef}`,
      heading: "تم إرسال عرض السعر",
      paragraph: (d) =>
        `مرحبًا ${d.customerName}، راجعنا طلبك <strong>${d.orderRef}</strong>.${
          d.estTotal != null ? ` الإجمالي التقديري: <strong>${formatAmount(d.estTotal, "ar")}</strong>.` : ""
        } سنتواصل معك عبر واتساب أو هاتفيًا لتأكيد السعر النهائي قبل بدء العمل.`,
    },
  },
  "order-accepted": {
    en: {
      subject: (d) => `Order ${d.orderRef} accepted`,
      heading: "Order accepted",
      paragraph: (d) =>
        `Good news, ${d.customerName} — order <strong>${d.orderRef}</strong> has been accepted${
          d.finalPrice != null ? ` at <strong>${formatAmount(d.finalPrice, "en")}</strong>` : ""
        }. We'll begin production and keep you updated on progress.`,
    },
    ar: {
      subject: (d) => `تم قبول طلبك ${d.orderRef}`,
      heading: "تم قبول الطلب",
      paragraph: (d) =>
        `أخبار سارة يا ${d.customerName} — تم قبول طلبك <strong>${d.orderRef}</strong>${
          d.finalPrice != null ? ` بسعر <strong>${formatAmount(d.finalPrice, "ar")}</strong>` : ""
        }. سنبدأ التنفيذ وسنبقيك على اطلاع بالتقدم.`,
    },
  },
  "order-declined": {
    en: {
      subject: (d) => `About your order ${d.orderRef}`,
      heading: "Order declined",
      paragraph: (d) =>
        `Hi ${d.customerName}, we're unable to proceed with order <strong>${d.orderRef}</strong> at this time. Message us on WhatsApp if you'd like to discuss it.`,
    },
    ar: {
      subject: (d) => `بخصوص طلبك ${d.orderRef}`,
      heading: "تم الاعتذار عن الطلب",
      paragraph: (d) =>
        `مرحبًا ${d.customerName}، لا يمكننا إتمام طلبك <strong>${d.orderRef}</strong> في الوقت الحالي. راسلنا على واتساب إذا رغبت بمناقشة التفاصيل.`,
    },
  },
  "order-ready": {
    en: {
      subject: (d) => `Order ${d.orderRef} is ready`,
      heading: "Order ready",
      paragraph: (d) =>
        `Hi ${d.customerName}, order <strong>${d.orderRef}</strong> is ready. We'll coordinate pickup or delivery with you directly.`,
    },
    ar: {
      subject: (d) => `طلبك ${d.orderRef} جاهز`,
      heading: "الطلب جاهز",
      paragraph: (d) =>
        `مرحبًا ${d.customerName}، طلبك <strong>${d.orderRef}</strong> أصبح جاهزًا. سننسّق معك مباشرة موعد الاستلام أو التوصيل.`,
    },
  },
};

/** Renders one of the five order-notification templates in the given locale. Pure/synchronous —
 * no I/O, no locale-negotiation — so it's trivial to unit test and safe to call from anywhere
 * server-side (see `notify.ts`, the actual send entry point). */
export function renderTemplate(
  template: EmailTemplate,
  locale: EmailLocale,
  data: EmailTemplateData,
): RenderedEmail {
  const copy = COPY[template][locale];
  const subject = copy.subject(data);
  const paragraph = copy.paragraph(data);
  const html = renderShell({
    locale,
    title: copy.heading,
    paragraphHtml: `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${paragraph}</p>`,
    whatsapp: data.whatsapp,
  });
  const text = stripHtml(paragraph);
  return { subject, html, text };
}
