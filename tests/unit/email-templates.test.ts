import { describe, expect, it } from "vitest";
import { renderTemplate, type EmailLocale, type EmailTemplateData } from "@/lib/email/templates";
import type { EmailTemplate } from "@/lib/email/types";

const TEMPLATES: EmailTemplate[] = [
  "order-received",
  "quotation-sent",
  "order-accepted",
  "order-declined",
  "order-ready",
];
const LOCALES: EmailLocale[] = ["ar", "en"];

const BASE_DATA: EmailTemplateData = {
  customerName: "Layla",
  orderRef: "RA-1042",
  estTotal: 350,
  finalPrice: 320,
  whatsapp: "+972 50-123-4567",
};

describe("renderTemplate", () => {
  for (const template of TEMPLATES) {
    for (const locale of LOCALES) {
      it(`renders "${template}" in "${locale}" with subject and html containing the order ref`, () => {
        const rendered = renderTemplate(template, locale, BASE_DATA);
        expect(rendered.subject).toContain(BASE_DATA.orderRef);
        expect(rendered.html).toContain(BASE_DATA.orderRef);
        expect(rendered.text).toContain(BASE_DATA.orderRef);
      });
    }
  }

  it("sets dir=\"rtl\" for Arabic and dir=\"ltr\" for English", () => {
    const ar = renderTemplate("order-received", "ar", BASE_DATA);
    const en = renderTemplate("order-received", "en", BASE_DATA);
    expect(ar.html).toContain('dir="rtl"');
    expect(en.html).toContain('dir="ltr"');
  });

  it("includes a wa.me link built from the whatsapp number", () => {
    const rendered = renderTemplate("order-received", "en", BASE_DATA);
    expect(rendered.html).toContain("https://wa.me/972501234567");
  });

  it("omits the estimated total from quotation-sent when estTotal is null", () => {
    const rendered = renderTemplate("quotation-sent", "en", { ...BASE_DATA, estTotal: null });
    expect(rendered.html).not.toContain("Estimated total");
  });

  it("includes the final price in order-accepted when finalPrice is set", () => {
    const rendered = renderTemplate("order-accepted", "en", BASE_DATA);
    expect(rendered.html).toContain("₪320");
  });

  it("text output has no HTML tags", () => {
    const rendered = renderTemplate("order-ready", "en", BASE_DATA);
    expect(rendered.text).not.toMatch(/<[^>]+>/);
  });
});
