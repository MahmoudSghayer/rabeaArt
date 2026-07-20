import type { SupportedLocale } from "@/i18n/routing";
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from "@/lib/orders/status";
import type { OrderStatus, PaymentStatus, ItemKind } from "@/generated/prisma/enums";
import { formatDate } from "@/components/admin/format";
import { pickItemLabel, type ItemLabelSource } from "./itemLabel";

/**
 * Shared row/header builder for BOTH orders CSV export routes
 * (src/app/api/admin/orders/export and .../orders/[id]/export) — the filtered-list download and
 * the per-order download must produce identical columns. Column set per the original spec (and
 * store.js `exportOrdersCSV`): ref / date / customer name / phone / whatsapp / email / item
 * names / types / sizes+colors / quantities / methods / estimated total / final price / status /
 * pay / customer notes. Multi-item cells join with " | ", mirroring store.js.
 *
 * Headers are a hardcoded ar/en data map (like CUSTOM_ITEM_LABELS in lib/orders/submit.ts)
 * rather than message-file lookups: they land in a downloaded artifact, not live UI.
 */

const HEADERS: Record<SupportedLocale, string[]> = {
  ar: [
    "رقم الطلب",
    "التاريخ",
    "الاسم",
    "الهاتف",
    "واتساب",
    "البريد",
    "المنتجات",
    "الأنواع",
    "المقاسات والألوان",
    "الكميات",
    "طريقة التنفيذ",
    "السعر التقديري",
    "السعر النهائي",
    "حالة الطلب",
    "حالة الدفع",
    "ملاحظات العميل",
  ],
  en: [
    "Order ref",
    "Date",
    "Customer",
    "Phone",
    "WhatsApp",
    "Email",
    "Products",
    "Types",
    "Sizes & colours",
    "Quantities",
    "Method",
    "Estimated",
    "Final price",
    "Status",
    "Payment",
    "Customer notes",
  ],
};

export function ordersCsvHeaders(locale: SupportedLocale): string[] {
  return HEADERS[locale];
}

export interface CsvOrderItem extends ItemLabelSource {
  kind: ItemKind;
  qty: number;
  optionsJson: unknown;
}

export interface CsvOrder {
  ref: string;
  createdAt: Date;
  status: OrderStatus;
  pay: PaymentStatus;
  estTotal: unknown; // Prisma Decimal | null — stringified below
  finalPrice: unknown;
  notes: string | null;
  customer: {
    name: string;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
  };
  items: CsvOrderItem[];
}

/** Best-effort read of a known option off an item's free-form `optionsJson` (shapes documented
 * in optionsSummary.ts) — returns "" instead of failing on custom items that don't carry it. */
function optionOf(json: unknown, ...keys: string[]): string {
  if (!json || typeof json !== "object" || Array.isArray(json)) return "";
  const record = json as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined || value === "") continue;
    return Array.isArray(value) ? value.map(String).join("/") : String(value);
  }
  return "";
}

function decimalCell(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function ordersCsvRow(
  order: CsvOrder,
  locale: SupportedLocale,
  t: (path: string) => string,
): string[] {
  const items = order.items;
  const sizeColor = (item: CsvOrderItem) => {
    const size = optionOf(item.optionsJson, "sizeCode", "size", "dims");
    const color = optionOf(item.optionsJson, "colorCode", "color");
    return [size, color].filter(Boolean).join(" / ");
  };

  return [
    order.ref,
    formatDate(order.createdAt, locale),
    order.customer.name,
    order.customer.phone ?? "",
    order.customer.whatsapp ?? "",
    order.customer.email ?? "",
    items.map((i) => pickItemLabel(i, locale)).join(" | "),
    items.map((i) => i.kind).join(" | "),
    items.map(sizeColor).join(" | "),
    items.map((i) => String(i.qty)).join(" | "),
    items.map((i) => optionOf(i.optionsJson, "method", "style")).join(" | "),
    decimalCell(order.estTotal),
    decimalCell(order.finalPrice),
    t(`orderStatus.${ORDER_STATUS_META[order.status].key}`),
    t(`paymentStatus.${PAYMENT_STATUS_META[order.pay].key}`),
    order.notes ?? "",
  ];
}
