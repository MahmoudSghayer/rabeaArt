import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";
import { requireRole, AuthError } from "@/lib/auth/requireRole";
import { checkRateLimit } from "@/lib/rate-limit";
import { csvResponseBody, toCsv } from "@/lib/csv";
import { createTranslator, getAdminLocale, getAdminMessages } from "@/app/admin/_lib/messages";
import {
  buildOrdersOrderBy,
  buildOrdersWhere,
  parseOrdersQuery,
  type OrdersSearchParams,
} from "@/app/admin/orders/query";
import { ordersCsvHeaders, ordersCsvRow } from "@/app/admin/orders/csv";

/** Talks to Postgres — must not run on the Edge runtime. */
export const runtime = "nodejs";

/** Memory-bound on a single export. Far above any realistic studio volume — if it's ever hit,
 * the date-range filters slice the export into smaller downloads. */
const MAX_EXPORT_ROWS = 5000;

/**
 * GET /api/admin/orders/export — CSV of every order matching the CURRENT list filters. Accepts
 * the exact same query params as /admin/orders (the "⤓ CSV" button forwards them verbatim; see
 * the URL-param contract in src/app/admin/orders/query.ts) and deliberately ignores `page`:
 * an export is "everything that matches", not "the page I'm looking at".
 *
 * requireRole(ADMIN): CSV export is an ADMIN-and-up capability in the role matrix (STAFF can
 * view/update orders but not bulk-export customer contact data).
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireRole(AdminRole.ADMIN);

    // RL-03: role gate is not volumetric — cap repeated list exports per admin (each is up to
    // 5000 rows + a joined items include). Keyed by admin id, not IP.
    const rl = await checkRateLimit({ key: `admin-export:orders:${admin.id}`, limit: 20, windowSeconds: 600 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "600" } });
    }

    const params: OrdersSearchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = parseOrdersQuery(params);
    const where = buildOrdersWhere(parsed);

    const orders = await prisma.order.findMany({
      where,
      orderBy: buildOrdersOrderBy(parsed.sort),
      take: MAX_EXPORT_ROWS,
      include: {
        customer: { select: { name: true, phone: true, whatsapp: true, email: true } },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            kind: true,
            qty: true,
            optionsJson: true,
            snapshotNameAr: true,
            snapshotNameEn: true,
            labelAr: true,
            labelEn: true,
          },
        },
      },
    });

    const locale = await getAdminLocale();
    const t = createTranslator(await getAdminMessages(locale), "");
    const rows = orders.map((order) => ordersCsvRow(order, locale, t));
    const csv = toCsv(ordersCsvHeaders(locale), rows);

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "csv.export",
        targetType: "Order",
        targetId: null,
        metadata: {
          scope: "orders-list",
          rowCount: rows.length,
          filters: {
            q: parsed.q,
            status: parsed.statuses,
            pay: parsed.pay,
            from: parsed.from?.toISOString() ?? null,
            to: parsed.to?.toISOString() ?? null,
            sort: parsed.sort,
          },
        },
      },
    });

    const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csvResponseBody(csv), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/admin/orders/export failed", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
