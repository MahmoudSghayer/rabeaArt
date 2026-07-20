import type { SupportedLocale } from "@/i18n/routing";
import type { ContactMethod } from "@/generated/prisma/enums";
import { formatDate } from "@/components/admin/format";

/**
 * Header/row builder for `/api/admin/customers/export`, mirroring the shape of
 * `src/app/admin/orders/csv.ts` (hardcoded ar/en data map — the download is a static artifact,
 * not live UI, so it doesn't go through the message-file lookup). Column set per AGENTS.md:
 * name / phone / whatsapp / email / country / city / full address / preferred contact / order
 * count / last order date / internal notes.
 */

const HEADERS: Record<SupportedLocale, string[]> = {
  ar: [
    "الاسم",
    "الهاتف",
    "واتساب",
    "البريد",
    "الدولة",
    "المدينة",
    "العنوان الكامل",
    "طريقة التواصل المفضلة",
    "عدد الطلبات",
    "آخر طلب",
    "ملاحظات داخلية",
  ],
  en: [
    "Name",
    "Phone",
    "WhatsApp",
    "Email",
    "Country",
    "City",
    "Full address",
    "Preferred contact",
    "Order count",
    "Last order date",
    "Internal notes",
  ],
};

export function customersCsvHeaders(locale: SupportedLocale): string[] {
  return HEADERS[locale];
}

const CONTACT_LABEL: Record<SupportedLocale, Record<ContactMethod, string>> = {
  ar: { PHONE: "الهاتف", WHATSAPP: "واتساب", EMAIL: "البريد", INTERNAL: "داخلي" },
  en: { PHONE: "Phone", WHATSAPP: "WhatsApp", EMAIL: "Email", INTERNAL: "Internal" },
};

export interface CsvCustomer {
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  street: string | null;
  building: string | null;
  apt: string | null;
  postal: string | null;
  preferredContact: ContactMethod | null;
  notes: string | null;
}

function composeFullAddress(c: CsvCustomer): string {
  return [c.street, c.building, c.apt, c.city, c.country, c.postal].filter(Boolean).join(", ");
}

export function customersCsvRow(
  customer: CsvCustomer,
  orderCount: number,
  lastOrderAt: Date | null,
  locale: SupportedLocale,
): string[] {
  return [
    customer.name,
    customer.phone ?? "",
    customer.whatsapp ?? "",
    customer.email ?? "",
    customer.country ?? "",
    customer.city ?? "",
    composeFullAddress(customer),
    customer.preferredContact ? CONTACT_LABEL[locale][customer.preferredContact] : "",
    String(orderCount),
    lastOrderAt ? formatDate(lastOrderAt, locale) : "",
    customer.notes ?? "",
  ];
}
