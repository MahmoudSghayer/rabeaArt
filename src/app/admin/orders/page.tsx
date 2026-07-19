import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "../_lib/require";
import { createTranslator, getAdminLocale, getAdminMessages } from "../_lib/messages";
import {
  buildOrdersOrderBy,
  buildOrdersWhere,
  firstValue,
  ORDERS_PAGE_SIZE,
  parseOrdersQuery,
  type OrdersSearchParams,
} from "./query";
import { pickItemLabel } from "./itemLabel";
import { OrdersFilterBar, type OrdersFilterValues } from "./OrdersFilterBar";
import { OrdersView, type OrderRow } from "./OrdersView";
import pageStyles from "../admin.module.css";

/** Builds the query string (no leading `?`, no `page`) that pagination links and the filter
 * bar's "current state" are both derived from — echoes the raw URL params back rather than
 * re-serializing the parsed/validated values, so an admin's exact input round-trips. */
function buildBaseQueryString(params: OrdersSearchParams): string {
  const qs = new URLSearchParams();
  const q = firstValue(params.q);
  const status = firstValue(params.status);
  const pay = firstValue(params.pay);
  const from = firstValue(params.from);
  const to = firstValue(params.to);
  const sort = firstValue(params.sort);
  if (q) qs.set("q", q);
  if (status) qs.set("status", status);
  if (pay) qs.set("pay", pay);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (sort && sort !== "newest") qs.set("sort", sort);
  return qs.toString();
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrdersSearchParams>;
}) {
  await requireAdminPage();
  const rawParams = await searchParams;
  const parsed = parseOrdersQuery(rawParams);
  const locale = await getAdminLocale();

  const where = buildOrdersWhere(parsed);
  const orderBy = buildOrdersOrderBy(parsed.sort);
  const skip = (parsed.page - 1) * ORDERS_PAGE_SIZE;

  let rows: OrderRow[] = [];
  let total = 0;
  let loadError = false;

  try {
    const [items, count] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy,
        skip,
        take: ORDERS_PAGE_SIZE,
        select: {
          id: true,
          ref: true,
          createdAt: true,
          status: true,
          pay: true,
          estTotal: true,
          finalPrice: true,
          archived: true,
          customer: { select: { name: true, phone: true } },
          items: {
            select: { snapshotNameAr: true, snapshotNameEn: true, labelAr: true, labelEn: true },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    total = count;
    rows = items.map((order) => {
      const [firstItem, ...rest] = order.items;
      return {
        id: order.id,
        ref: order.ref,
        createdAt: order.createdAt.toISOString(),
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
        firstItemLabel: firstItem ? pickItemLabel(firstItem, locale) : "",
        moreItemsCount: rest.length,
        status: order.status,
        pay: order.pay,
        total: order.finalPrice !== null ? Number(order.finalPrice) : order.estTotal !== null ? Number(order.estTotal) : null,
        archived: order.archived,
      };
    });
  } catch (err) {
    console.error("AdminOrdersPage: failed to load orders", err);
    loadError = true;
  }

  const baseQuery = buildBaseQueryString(rawParams);
  const csvHref = `/api/admin/orders/export${baseQuery ? `?${baseQuery}` : ""}`;
  const filterInitial: OrdersFilterValues = {
    q: firstValue(rawParams.q) ?? "",
    status: firstValue(rawParams.status) ?? "",
    pay: firstValue(rawParams.pay) ?? "",
    from: firstValue(rawParams.from) ?? "",
    to: firstValue(rawParams.to) ?? "",
    sort: parsed.sort,
  };

  const loadErrorText = loadError
    ? createTranslator(await getAdminMessages(locale), "adminOrders")("loadError")
    : null;

  return (
    <div className={pageStyles.page}>
      <OrdersFilterBar key={baseQuery} initial={filterInitial} csvHref={csvHref} />
      {loadErrorText ? (
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 20 }}>{loadErrorText}</div>
      ) : (
        <OrdersView rows={rows} total={total} page={parsed.page} pageSize={ORDERS_PAGE_SIZE} baseQuery={baseQuery} />
      )}
    </div>
  );
}
