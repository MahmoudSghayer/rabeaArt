import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";
import { requireRole, AuthError } from "@/lib/auth/requireRole";
import { csvResponseBody, toCsv } from "@/lib/csv";
import { getAdminLocale } from "@/app/admin/_lib/messages";
import { buildCustomersWhere, parseCustomersQuery, type CustomersSearchParams } from "@/app/admin/customers/query";
import { customersCsvHeaders, customersCsvRow } from "@/app/admin/customers/csv";

/** Talks to Postgres — must not run on the Edge runtime. */
export const runtime = "nodejs";

/** Same safety cap as `/api/admin/orders/export` — far above any realistic studio customer count. */
const MAX_EXPORT_ROWS = 5000;

/**
 * GET /api/admin/customers/export — CSV of every customer matching the customers list's CURRENT
 * search filter (`q`, same field as `/admin/customers` — see the URL-param contract in
 * `src/app/admin/customers/query.ts`).
 *
 * requireRole(ADMIN): CSV export is an ADMIN-and-up capability in the role matrix, same as the
 * orders export — bulk customer contact data shouldn't be STAFF-exportable.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireRole(AdminRole.ADMIN);

    const params: CustomersSearchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = parseCustomersQuery(params);
    const where = buildCustomersWhere(parsed);

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_EXPORT_ROWS,
      select: {
        id: true,
        name: true,
        phone: true,
        whatsapp: true,
        email: true,
        country: true,
        city: true,
        street: true,
        building: true,
        apt: true,
        postal: true,
        preferredContact: true,
        notes: true,
      },
    });

    // One grouped query for order count + last order date across every matched customer, rather
    // than N+1 (same "single aggregate query" rule as the list page's lifetime-value lookup —
    // see src/app/admin/customers/page.tsx). No COALESCE needed here (CSV columns don't include
    // lifetime value, only order count / last order date), so Prisma's own `groupBy` suffices.
    const customerIds = customers.map((c) => c.id);
    const aggregates =
      customerIds.length > 0
        ? await prisma.order.groupBy({
            by: ["customerId"],
            where: { customerId: { in: customerIds }, archived: false },
            _count: { _all: true },
            _max: { createdAt: true },
          })
        : [];
    const aggByCustomer = new Map(aggregates.map((a) => [a.customerId, a]));

    const locale = await getAdminLocale();
    const rows = customers.map((c) => {
      const agg = aggByCustomer.get(c.id);
      return customersCsvRow(c, agg?._count._all ?? 0, agg?._max.createdAt ?? null, locale);
    });
    const csv = toCsv(customersCsvHeaders(locale), rows);

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "csv.export",
        targetType: "Customer",
        targetId: null,
        metadata: {
          scope: "customers-list",
          rowCount: rows.length,
          filters: { q: parsed.q },
        },
      },
    });

    const filename = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
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
    console.error("GET /api/admin/customers/export failed", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
