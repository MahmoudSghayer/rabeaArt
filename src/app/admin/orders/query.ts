import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The single source of truth for the orders-list URL-param contract, shared by the orders list
 * page (src/app/admin/orders/page.tsx) and both CSV export routes
 * (src/app/api/admin/orders/export/route.ts) — filtering must always agree between "what's on
 * screen" and "what's in the download".
 *
 * URL params:
 *  - `q`: free-text search against order ref OR customer name/phone/email (case-insensitive).
 *  - `status`: one OR MORE `OrderStatus` values, comma-separated (e.g. "REVIEW,QUOTED,NEEDS_INFO")
 *    — a single value is just a list of one. The Overview page's grouped stat cards
 *    ("Awaiting approval", "In progress") deep-link here with several statuses at once; the
 *    orders-list filter select only ever sends one.
 *  - `pay`: one `PaymentStatus` value.
 *  - `from`/`to`: inclusive `createdAt` date range, `YYYY-MM-DD`.
 *  - `sort`: "newest" (default) | "oldest" | "valueDesc".
 *  - `page`: 1-based page number (page size: `ORDERS_PAGE_SIZE`).
 */

export const ORDERS_PAGE_SIZE = 20;

export type OrdersSort = "newest" | "oldest" | "valueDesc";

/** Matches Next's `searchParams` shape: values may arrive as a single string or (if a param is
 * repeated in the URL) a string array — every field here is read defensively either way. */
export type OrdersSearchParams = Record<string, string | string[] | undefined>;

export interface ParsedOrdersQuery {
  q: string | null;
  statuses: OrderStatus[];
  pay: PaymentStatus | null;
  from: Date | null;
  to: Date | null;
  sort: OrdersSort;
  page: number;
}

const VALID_STATUSES = new Set<string>(Object.values(OrderStatus));
const VALID_PAYS = new Set<string>(Object.values(PaymentStatus));

/** Exported so callers (the orders page) can read the same raw string values used for parsing —
 * e.g. to echo them back into the filter bar / pagination links without round-tripping through a
 * `Date`. */
export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const DATE_PARAM_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a `YYYY-MM-DD` URL param into the UTC start (00:00:00.000) or end (23:59:59.999) of
 * that day. Returns null for anything missing/malformed rather than throwing — a bad date filter
 * should silently drop that half of the range, not break the whole page. */
function parseDateParam(value: string | undefined, edge: "start" | "end"): Date | null {
  if (!value) return null;
  const match = DATE_PARAM_PATTERN.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date =
    edge === "start"
      ? new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0))
      : new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseOrdersQuery(params: OrdersSearchParams): ParsedOrdersQuery {
  const q = firstValue(params.q)?.trim() || null;

  const statuses = (firstValue(params.status) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => VALID_STATUSES.has(s)) as OrderStatus[];

  const payRaw = firstValue(params.pay);
  const pay = payRaw && VALID_PAYS.has(payRaw) ? (payRaw as PaymentStatus) : null;

  const from = parseDateParam(firstValue(params.from), "start");
  const to = parseDateParam(firstValue(params.to), "end");

  const sortRaw = firstValue(params.sort);
  const sort: OrdersSort = sortRaw === "oldest" || sortRaw === "valueDesc" ? sortRaw : "newest";

  const pageRaw = Number(firstValue(params.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  return { q, statuses, pay, from, to, sort, page };
}

export function buildOrdersWhere(parsed: ParsedOrdersQuery): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];

  if (parsed.q) {
    and.push({
      OR: [
        { ref: { contains: parsed.q, mode: "insensitive" } },
        { customer: { name: { contains: parsed.q, mode: "insensitive" } } },
        { customer: { phone: { contains: parsed.q, mode: "insensitive" } } },
        { customer: { email: { contains: parsed.q, mode: "insensitive" } } },
      ],
    });
  }
  if (parsed.statuses.length > 0) and.push({ status: { in: parsed.statuses } });
  if (parsed.pay) and.push({ pay: parsed.pay });
  if (parsed.from || parsed.to) {
    and.push({
      createdAt: {
        ...(parsed.from ? { gte: parsed.from } : {}),
        ...(parsed.to ? { lte: parsed.to } : {}),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function buildOrdersOrderBy(sort: OrdersSort): Prisma.OrderOrderByWithRelationInput[] {
  if (sort === "oldest") return [{ createdAt: "asc" }];
  // Orders priced "after review" (estTotal: null) sort last regardless of direction — they don't
  // have a meaningful position in a value ranking.
  if (sort === "valueDesc") return [{ estTotal: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
  return [{ createdAt: "desc" }];
}
