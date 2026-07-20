import type { Prisma } from "@/generated/prisma/client";

/**
 * URL-param contract for the customers list, mirroring the orders list's
 * `src/app/admin/orders/query.ts` pattern (kept as a separate, self-contained module here since
 * customers/** and orders/** are owned by different workstreams — see AGENTS.md file ownership).
 *
 * URL params:
 *  - `q`: free-text search against name / phone / email (case-insensitive).
 *  - `page`: 1-based page number (page size: `CUSTOMERS_PAGE_SIZE`).
 */

export const CUSTOMERS_PAGE_SIZE = 20;

/** Matches Next's `searchParams` shape: values may arrive as a single string or (if a param is
 * repeated in the URL) a string array — read defensively either way. */
export type CustomersSearchParams = Record<string, string | string[] | undefined>;

export interface ParsedCustomersQuery {
  q: string | null;
  page: number;
}

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseCustomersQuery(params: CustomersSearchParams): ParsedCustomersQuery {
  const q = firstValue(params.q)?.trim() || null;
  const pageRaw = Number(firstValue(params.page));
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  return { q, page };
}

/** Search fields per the project plan: name / phone / email, case-insensitive. */
export function buildCustomersWhere(parsed: ParsedCustomersQuery): Prisma.CustomerWhereInput {
  if (!parsed.q) return {};
  return {
    OR: [
      { name: { contains: parsed.q, mode: "insensitive" } },
      { phone: { contains: parsed.q, mode: "insensitive" } },
      { email: { contains: parsed.q, mode: "insensitive" } },
    ],
  };
}
