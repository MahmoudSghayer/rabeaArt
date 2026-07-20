import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "../../_lib/require";
import { createTranslator, getAdminLocale, getAdminMessages } from "../../_lib/messages";
import { pickItemLabel } from "../itemLabel";
import { summarizeOptions } from "../optionsSummary";
import { OrderDetailView, type OrderDetailData } from "./OrderDetailView";
import pageStyles from "../../admin.module.css";

function toIsoDate(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

async function loadOrder(id: string, locale: "ar" | "en"): Promise<OrderDetailData | null> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          files: { orderBy: { createdAt: "asc" } },
          product: { select: { nameAr: true, nameEn: true } },
        },
      },
      history: { orderBy: { at: "desc" }, include: { byAdmin: { select: { name: true } } } },
      communications: {
        where: { channel: "INTERNAL" },
        orderBy: { at: "desc" },
        include: { byAdmin: { select: { name: true } } },
      },
    },
  });
  if (!order) return null;

  return {
    id: order.id,
    ref: order.ref,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    pay: order.pay,
    archived: order.archived,
    estTotal: order.estTotal !== null ? Number(order.estTotal) : null,
    finalPrice: order.finalPrice !== null ? Number(order.finalPrice) : null,
    eta: toIsoDate(order.eta),
    notes: order.notes,
    contactMethod: order.contactMethod,
    customer: {
      id: order.customer.id,
      name: order.customer.name,
      phone: order.customer.phone,
      whatsapp: order.customer.whatsapp,
      email: order.customer.email,
      country: order.customer.country,
      city: order.customer.city,
      street: order.customer.street,
      building: order.customer.building,
      apt: order.customer.apt,
      postal: order.customer.postal,
      instructions: order.customer.instructions,
      preferredContact: order.customer.preferredContact,
    },
    items: order.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      label: pickItemLabel(item, locale),
      qty: item.qty,
      unitPrice: item.unitPrice !== null ? Number(item.unitPrice) : null,
      options: summarizeOptions(item.optionsJson),
      notes: item.notes,
      files: item.files.map((f) => ({ id: f.id, name: f.originalName, size: f.size })),
    })),
    internalNotes: order.communications.map((c) => ({
      id: c.id,
      text: c.text,
      byName: c.byAdmin.name,
      at: c.at.toISOString(),
    })),
    history: order.history.map((h) => ({
      id: h.id,
      status: h.status,
      note: h.note,
      byName: h.byAdmin?.name ?? null,
      at: h.at.toISOString(),
    })),
  };
}

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const locale = await getAdminLocale();

  let order: OrderDetailData | null;
  let loadFailed = false;
  try {
    order = await loadOrder(id, locale);
  } catch (err) {
    console.error("AdminOrderDetailPage: failed to load order", err);
    order = null;
    loadFailed = true;
  }

  // A genuinely missing order (bad id, deleted row) renders the standard Next.js 404 — a query
  // failure (DB briefly unreachable) instead shows a designed error state, since that's not the
  // same situation and shouldn't look like "this order doesn't exist".
  if (!order && !loadFailed) notFound();

  if (!order) {
    const t = createTranslator(await getAdminMessages(locale), "adminCommon");
    return (
      <div className={pageStyles.page}>
        <div style={{ textAlign: "center", color: "#8A8070", fontSize: 13, padding: 40 }}>
          {t("errorGeneric")}
        </div>
      </div>
    );
  }

  return (
    <div className={pageStyles.page}>
      <OrderDetailView order={order} />
    </div>
  );
}
