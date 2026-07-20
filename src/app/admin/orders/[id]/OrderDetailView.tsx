"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ContactMethod, ItemKind, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { OrderStatusPill, PaymentStatusPill } from "@/components/ui/StatusPill";
import { formatDate } from "@/components/admin/format";
import type { SupportedLocale } from "@/i18n/routing";
import type { OptionEntry } from "../optionsSummary";
import { DetailToolbar } from "./DetailToolbar";
import { ItemsPanel } from "./ItemsPanel";
import { InternalNotesPanel, type InternalNote } from "./InternalNotesPanel";
import { HistoryPanel } from "./HistoryPanel";
import { CustomerCard } from "./CustomerCard";
import { ManagePanel } from "./ManagePanel";
import styles from "./orderDetail.module.css";

export interface OrderDetailItem {
  id: string;
  kind: ItemKind;
  label: string;
  qty: number;
  unitPrice: number | null;
  options: OptionEntry[];
  notes: string | null;
  files: { id: string; name: string; size: number }[];
}

export interface OrderHistoryEntry {
  id: string;
  status: OrderStatus;
  note: string | null;
  byName: string | null;
  at: string;
}

export interface OrderDetailData {
  id: string;
  ref: string;
  createdAt: string;
  status: OrderStatus;
  pay: PaymentStatus;
  archived: boolean;
  estTotal: number | null;
  finalPrice: number | null;
  /** `YYYY-MM-DD` or null. */
  eta: string | null;
  notes: string | null;
  contactMethod: ContactMethod;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    country: string | null;
    city: string | null;
    street: string | null;
    building: string | null;
    apt: string | null;
    postal: string | null;
    instructions: string | null;
    preferredContact: ContactMethod | null;
  };
  items: OrderDetailItem[];
  internalNotes: InternalNote[];
  history: OrderHistoryEntry[];
}

export function OrderDetailView({ order }: { order: OrderDetailData }) {
  const t = useTranslations("adminOrderDetail");
  const locale = useLocale() as SupportedLocale;

  return (
    <>
      <DetailToolbar orderId={order.id} archived={order.archived} />

      <div className={styles.titleRow}>
        <h2 className={styles.refTitle}>
          <span dir="ltr">{order.ref}</span>
        </h2>
        <span className={styles.dateText}>{formatDate(order.createdAt, locale)}</span>
        <OrderStatusPill status={order.status} />
        <PaymentStatusPill status={order.pay} />
        {order.archived && <span className={styles.archivedPill}>{t("archived")}</span>}
      </div>

      <div className={styles.grid}>
        <div className={styles.col}>
          <ItemsPanel items={order.items} estTotal={order.estTotal} custNotes={order.notes} />
          <div data-noprint="1">
            <InternalNotesPanel orderId={order.id} notes={order.internalNotes} />
          </div>
          <HistoryPanel history={order.history} />
        </div>
        <div className={styles.col}>
          <CustomerCard
            orderId={order.id}
            orderRef={order.ref}
            status={order.status}
            finalPrice={order.finalPrice}
            contactMethod={order.contactMethod}
            customer={order.customer}
          />
          <ManagePanel
            orderId={order.id}
            status={order.status}
            pay={order.pay}
            finalPrice={order.finalPrice}
            eta={order.eta}
          />
        </div>
      </div>
    </>
  );
}
