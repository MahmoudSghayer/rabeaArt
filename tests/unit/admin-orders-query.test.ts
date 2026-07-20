import { describe, expect, it } from "vitest";
import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import {
  buildOrdersOrderBy,
  buildOrdersWhere,
  firstValue,
  ORDERS_PAGE_SIZE,
  parseOrdersQuery,
} from "@/app/admin/orders/query";

/**
 * `query.ts` imports `Prisma` only as a type (erased at compile time), so its runtime exports —
 * the parse/where/orderBy helpers — are unit-testable without a database. See AGENTS.md/task
 * plan note on DB-touching parts belonging to a later integration layer.
 */

describe("firstValue", () => {
  it("passes through a plain string", () => {
    expect(firstValue("hello")).toBe("hello");
  });

  it("takes the first entry of an array", () => {
    expect(firstValue(["a", "b"])).toBe("a");
  });

  it("returns undefined for undefined", () => {
    expect(firstValue(undefined)).toBeUndefined();
  });
});

describe("parseOrdersQuery — q", () => {
  it("trims whitespace and defaults to null when empty", () => {
    expect(parseOrdersQuery({ q: "  Nour  " }).q).toBe("Nour");
    expect(parseOrdersQuery({ q: "   " }).q).toBeNull();
    expect(parseOrdersQuery({}).q).toBeNull();
  });
});

describe("parseOrdersQuery — statuses", () => {
  it("parses a single status", () => {
    expect(parseOrdersQuery({ status: "REVIEW" }).statuses).toEqual([OrderStatus.REVIEW]);
  });

  it("parses a comma-separated list, trimming each entry", () => {
    expect(parseOrdersQuery({ status: "REVIEW, QUOTED ,NEEDS_INFO" }).statuses).toEqual([
      OrderStatus.REVIEW,
      OrderStatus.QUOTED,
      OrderStatus.NEEDS_INFO,
    ]);
  });

  it("silently drops unknown status values instead of throwing", () => {
    expect(parseOrdersQuery({ status: "REVIEW,BOGUS" }).statuses).toEqual([OrderStatus.REVIEW]);
  });

  it("returns an empty array when absent", () => {
    expect(parseOrdersQuery({}).statuses).toEqual([]);
  });
});

describe("parseOrdersQuery — pay", () => {
  it("accepts a valid PaymentStatus", () => {
    expect(parseOrdersQuery({ pay: "PAID" }).pay).toBe(PaymentStatus.PAID);
  });

  it("rejects an unknown value back to null", () => {
    expect(parseOrdersQuery({ pay: "BOGUS" }).pay).toBeNull();
  });
});

describe("parseOrdersQuery — date range boundaries", () => {
  it("parses 'from' as the UTC start of that day (00:00:00.000)", () => {
    const { from } = parseOrdersQuery({ from: "2026-07-20" });
    expect(from?.toISOString()).toBe("2026-07-20T00:00:00.000Z");
  });

  it("parses 'to' as the UTC end of that day (23:59:59.999) — inclusive boundary", () => {
    const { to } = parseOrdersQuery({ to: "2026-07-20" });
    expect(to?.toISOString()).toBe("2026-07-20T23:59:59.999Z");
  });

  it("returns null for a missing date", () => {
    expect(parseOrdersQuery({}).from).toBeNull();
    expect(parseOrdersQuery({}).to).toBeNull();
  });

  it.each(["2026/07/20", "20-07-2026", "not-a-date", "2026-7-2", ""])(
    "ignores a shape-malformed date '%s' rather than throwing",
    (bad) => {
      expect(parseOrdersQuery({ from: bad }).from).toBeNull();
    },
  );

  /**
   * KNOWN GAP (documented, not asserted as "correct"): `parseDateParam`'s regex only checks
   * digit *shape* (`\d{4}-\d{2}-\d{2}`), not calendar validity, and then feeds the parts straight
   * into `Date.UTC`, which never returns NaN for out-of-range month/day — it silently rolls
   * over instead (e.g. day 30 in a 28-day February becomes March 2). So `Number.isNaN(date.getTime())`
   * can never actually catch a bad calendar date; a `from`/`to` filter typed as "2026-02-30" quietly
   * becomes 2026-03-02 with no error surfaced to the admin. Pinned here so a future fix (e.g.
   * validating the round-tripped y/m/d) shows up as an intentional test change, not a silent
   * behavior change. See report notes for this task.
   */
  it("rollover gap: an out-of-range day silently rolls into the next month instead of being rejected", () => {
    expect(parseOrdersQuery({ from: "2026-02-30" }).from?.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });

  it("rollover gap: an out-of-range month (13) silently rolls into next year's January", () => {
    expect(parseOrdersQuery({ from: "2026-13-40" }).from?.toISOString()).toBe("2027-02-09T00:00:00.000Z");
  });
});

describe("parseOrdersQuery — sort", () => {
  it("defaults to 'newest'", () => {
    expect(parseOrdersQuery({}).sort).toBe("newest");
  });

  it.each(["oldest", "valueDesc"])("accepts '%s'", (sort) => {
    expect(parseOrdersQuery({ sort }).sort).toBe(sort);
  });

  it("falls back to 'newest' for an unknown value", () => {
    expect(parseOrdersQuery({ sort: "bogus" }).sort).toBe("newest");
  });
});

describe("parseOrdersQuery — page", () => {
  it("defaults to 1", () => {
    expect(parseOrdersQuery({}).page).toBe(1);
  });

  it("accepts a positive integer", () => {
    expect(parseOrdersQuery({ page: "3" }).page).toBe(3);
  });

  it("rejects 0, negative, fractional, and non-numeric values back to 1", () => {
    expect(parseOrdersQuery({ page: "0" }).page).toBe(1);
    expect(parseOrdersQuery({ page: "-2" }).page).toBe(1);
    expect(parseOrdersQuery({ page: "2.5" }).page).toBe(1);
    expect(parseOrdersQuery({ page: "abc" }).page).toBe(1);
  });
});

describe("ORDERS_PAGE_SIZE", () => {
  it("is 20", () => {
    expect(ORDERS_PAGE_SIZE).toBe(20);
  });
});

describe("buildOrdersWhere", () => {
  it("returns an empty object when nothing is filtered", () => {
    expect(buildOrdersWhere(parseOrdersQuery({}))).toEqual({});
  });

  it("builds an OR clause across ref/name/phone/email for q", () => {
    const where = buildOrdersWhere(parseOrdersQuery({ q: "Nour" }));
    expect(where).toEqual({
      AND: [
        {
          OR: [
            { ref: { contains: "Nour", mode: "insensitive" } },
            { customer: { name: { contains: "Nour", mode: "insensitive" } } },
            { customer: { phone: { contains: "Nour", mode: "insensitive" } } },
            { customer: { email: { contains: "Nour", mode: "insensitive" } } },
          ],
        },
      ],
    });
  });

  it("adds a status 'in' clause when statuses are present", () => {
    const where = buildOrdersWhere(parseOrdersQuery({ status: "REVIEW,QUOTED" }));
    expect(where).toEqual({ AND: [{ status: { in: [OrderStatus.REVIEW, OrderStatus.QUOTED] } }] });
  });

  it("adds a pay clause when pay is present", () => {
    const where = buildOrdersWhere(parseOrdersQuery({ pay: "UNPAID" }));
    expect(where).toEqual({ AND: [{ pay: PaymentStatus.UNPAID }] });
  });

  it("combines from/to into a single createdAt range clause", () => {
    const where = buildOrdersWhere(parseOrdersQuery({ from: "2026-07-01", to: "2026-07-20" }));
    expect(where).toEqual({
      AND: [
        {
          createdAt: {
            gte: new Date("2026-07-01T00:00:00.000Z"),
            lte: new Date("2026-07-20T23:59:59.999Z"),
          },
        },
      ],
    });
  });

  it("uses only 'gte' when only 'from' is set", () => {
    const where = buildOrdersWhere(parseOrdersQuery({ from: "2026-07-01" }));
    expect(where).toEqual({
      AND: [{ createdAt: { gte: new Date("2026-07-01T00:00:00.000Z") } }],
    });
  });

  it("combines every filter into one AND array, in declaration order", () => {
    const where = buildOrdersWhere(
      parseOrdersQuery({ q: "Nour", status: "REVIEW", pay: "PAID", from: "2026-07-01" }),
    );
    expect(where).toMatchObject({
      AND: [{ OR: expect.any(Array) }, { status: { in: [OrderStatus.REVIEW] } }, { pay: PaymentStatus.PAID }, { createdAt: expect.any(Object) }],
    });
  });
});

describe("buildOrdersOrderBy", () => {
  it("orders 'newest' by createdAt desc", () => {
    expect(buildOrdersOrderBy("newest")).toEqual([{ createdAt: "desc" }]);
  });

  it("orders 'oldest' by createdAt asc", () => {
    expect(buildOrdersOrderBy("oldest")).toEqual([{ createdAt: "asc" }]);
  });

  it("orders 'valueDesc' by estTotal desc with nulls last, then createdAt desc as a tiebreaker", () => {
    expect(buildOrdersOrderBy("valueDesc")).toEqual([
      { estTotal: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ]);
  });
});
