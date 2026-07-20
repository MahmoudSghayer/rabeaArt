/**
 * URL-param contract for the reports page's date-range filter, applied to every query on the
 * page. Same `YYYY-MM-DD` parsing rules as `admin/orders/query.ts`'s `from`/`to` (duplicated
 * locally, not imported — `admin/orders/**` is owned by a different parallel workstream, see
 * AGENTS.md).
 */
export type ReportsSearchParams = Record<string, string | string[] | undefined>;

export interface ParsedReportsQuery {
  from: Date | null;
  to: Date | null;
  /** Raw `YYYY-MM-DD` strings, echoed back into the filter bar / CSV shortcut links without
   * round-tripping through a `Date`. */
  fromRaw: string;
  toRaw: string;
}

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const DATE_PARAM_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export function parseReportsQuery(params: ReportsSearchParams): ParsedReportsQuery {
  const fromRaw = firstValue(params.from) ?? "";
  const toRaw = firstValue(params.to) ?? "";
  return {
    from: parseDateParam(fromRaw, "start"),
    to: parseDateParam(toRaw, "end"),
    fromRaw,
    toRaw,
  };
}

/** `createdAt` range filter shared by every reports query — empty object when no range is set. */
export function dateRangeFilter(parsed: ParsedReportsQuery): { gte?: Date; lte?: Date } | undefined {
  if (!parsed.from && !parsed.to) return undefined;
  return {
    ...(parsed.from ? { gte: parsed.from } : {}),
    ...(parsed.to ? { lte: parsed.to } : {}),
  };
}
