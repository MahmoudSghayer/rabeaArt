import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";
import { requireRole, AuthError } from "@/lib/auth/requireRole";
import { csvResponseBody, toCsv } from "@/lib/csv";
import { createTranslator, getAdminLocale, getAdminMessages } from "@/app/admin/_lib/messages";
import { ordersCsvHeaders, ordersCsvRow } from "@/app/admin/orders/csv";

/** Talks to Postgres — must not run on the Edge runtime. */
export const runtime = "nodejs";

/**
 * GET /api/admin/orders/[id]/export — single-order CSV with the exact same columns as the
 * filtered-list export (shared builder: src/app/admin/orders/csv.ts). Same requireRole(ADMIN)
 * bar as the list export — it's the same customer contact data, just one row of it.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(AdminRole.ADMIN);

    const { id } = await ctx.params;
    const order = await prisma.order.findUnique({
      where: { id },
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
    if (!order) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const locale = await getAdminLocale();
    const t = createTranslator(await getAdminMessages(locale), "");
    const csv = toCsv(ordersCsvHeaders(locale), [ordersCsvRow(order, locale, t)]);

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "csv.export",
        targetType: "Order",
        targetId: order.id,
        metadata: { scope: "single-order", rowCount: 1, ref: order.ref },
      },
    });

    const filename = `order-${order.ref}-${new Date().toISOString().slice(0, 10)}.csv`;
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
    console.error("GET /api/admin/orders/[id]/export failed", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
