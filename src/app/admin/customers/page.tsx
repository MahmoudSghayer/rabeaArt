import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "../_lib/require";
import { createTranslator, getAdminLocale, getAdminMessages } from "../_lib/messages";
import { formatDate } from "@/components/admin/format";
import {
  buildCustomersWhere,
  CUSTOMERS_PAGE_SIZE,
  firstValue,
  parseCustomersQuery,
  type CustomersSearchParams,
} from "./query";
import { avatarColorForIndex } from "./avatar";
import { CustomersFilterBar } from "./CustomersFilterBar";
import { CustomersView, type CustomerRow } from "./CustomersView";
import pageStyles from "../admin.module.css";

/**
 * Per-page order aggregate (count / last order date / lifetime value) for the customers CURRENTLY
 * ON SCREEN, in a single grouped raw query rather than one query per row (N+1). Prisma's
 * `groupBy()` can't express `COALESCE(finalPrice, estTotal)` inside `_sum`, so this uses
 * `$queryRaw` — the same escape hatch `lib/orders/submit.ts` uses for its ref sequence. "Lifetime
 * value" = sum of `finalPrice ?? estTotal` over the customer's NON-ARCHIVED orders (archived
 * orders are excluded from `orderCount`/`lastOrderAt` too, for consistency with that definition).
 */
type CustomerAggregate = {
  customerId: string;
  orderCount: number;
  lastOrderAt: Date | null;
  lifetimeValue: string | number | null;
};

async function loadOrderAggregates(customerIds: string[]): Promise<Map<string, CustomerAggregate>> {
  if (customerIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<CustomerAggregate[]>`
    SELECT "customerId" AS "customerId",
           COUNT(*)::int AS "orderCount",
           MAX("createdAt") AS "lastOrderAt",
           SUM(COALESCE("finalPrice", "estTotal", 0))::numeric AS "lifetimeValue"
    FROM "orders"
    WHERE "archived" = false AND "customerId" = ANY(${customerIds}::text[])
    GROUP BY "customerId"
  `;
  return new Map(rows.map((r) => [r.customerId, r]));
}

/** Builds the query string (no leading `?`, no `page`) pagination links are derived from. */
function buildBaseQueryString(params: CustomersSearchParams): string {
  const qs = new URLSearchParams();
  const q = firstValue(params.q);
  if (q) qs.set("q", q);
  return qs.toString();
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<CustomersSearchParams>;
}) {
  await requireAdminPage();
  const rawParams = await searchParams;
  const parsed = parseCustomersQuery(rawParams);
  const locale = await getAdminLocale();

  const where = buildCustomersWhere(parsed);
  const skip = (parsed.page - 1) * CUSTOMERS_PAGE_SIZE;

  let rows: CustomerRow[] = [];
  let total = 0;
  let loadError = false;

  try {
    const [items, count] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: CUSTOMERS_PAGE_SIZE,
        select: { id: true, name: true, phone: true, city: true },
      }),
      prisma.customer.count({ where }),
    ]);

    total = count;
    const aggregates = await loadOrderAggregates(items.map((c) => c.id));

    rows = items.map((customer, index) => {
      const agg = aggregates.get(customer.id);
      return {
        id: customer.id,
        name: customer.name,
        avatarColor: avatarColorForIndex(index),
        phone: customer.phone,
        city: customer.city,
        orderCount: agg?.orderCount ?? 0,
        lastOrderDate: agg?.lastOrderAt ? formatDate(agg.lastOrderAt, locale) : null,
        lifetimeValue: agg?.lifetimeValue ? Number(agg.lifetimeValue) : 0,
      };
    });
  } catch (err) {
    console.error("AdminCustomersPage: failed to load customers", err);
    loadError = true;
  }

  const baseQuery = buildBaseQueryString(rawParams);
  const csvHref = `/api/admin/customers/export${baseQuery ? `?${baseQuery}` : ""}`;

  const loadErrorText = loadError
    ? createTranslator(await getAdminMessages(locale), "adminCustomers")("loadError")
    : null;

  return (
    <div className={pageStyles.page}>
      <CustomersFilterBar key={baseQuery} initialQ={parsed.q ?? ""} csvHref={csvHref} />
      {loadErrorText ? (
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 20 }}>{loadErrorText}</div>
      ) : (
        <CustomersView rows={rows} total={total} page={parsed.page} pageSize={CUSTOMERS_PAGE_SIZE} baseQuery={baseQuery} />
      )}
    </div>
  );
}
