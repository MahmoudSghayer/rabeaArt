"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ContactMethod, OrderStatus } from "@/generated/prisma/enums";
import { OrderStatusPill } from "@/components/ui/StatusPill";
import { phoneDigits } from "@/components/admin/format";
import { NotesPanel } from "./NotesPanel";
import styles from "./customerDetail.module.css";

export interface CustomerOrderRow {
  id: string;
  ref: string;
  date: string;
  status: OrderStatus;
  total: string;
}

export interface CustomerDetailData {
  id: string;
  name: string;
  avatarColor: string;
  since: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string;
  preferredContact: ContactMethod | null;
  notes: string;
  possibleDuplicate: boolean;
  orderCount: number;
  lifetimeValue: string;
  orders: CustomerOrderRow[];
}

/** Maps a contact preference to the storefront's `actions.*` message key — same mapping as
 * `orders/[id]/CustomerCard.tsx` (duplicated locally rather than imported: `admin/orders/**` is
 * owned by a different parallel workstream, see AGENTS.md). */
const CONTACT_METHOD_ACTION_KEY: Record<Exclude<ContactMethod, "INTERNAL">, string> = {
  PHONE: "call",
  WHATSAPP: "whatsapp",
  EMAIL: "email",
};

export function CustomerDetailView({ customer }: { customer: CustomerDetailData }) {
  const t = useTranslations("adminCustomers");
  const tCommon = useTranslations("adminCommon");
  const tActions = useTranslations("actions");
  const tContact = useTranslations("adminContactMethod");

  const waNumber = customer.whatsapp || customer.phone || "";
  const waHref = waNumber ? `https://wa.me/${phoneDigits(waNumber)}` : null;
  const mailHref = customer.email ? `mailto:${customer.email}` : null;

  return (
    <>
      <div className={styles.toolbar} data-noprint="1">
        <Link href="/admin/customers" className={styles.backBtn}>
          {tCommon("arrowBack")} {t("backToList")}
        </Link>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.head}>
            <span className={styles.avatar} style={{ background: customer.avatarColor }} aria-hidden="true">
              {[...customer.name.trim()][0]?.toUpperCase() ?? "?"}
            </span>
            <div>
              <div className={styles.name}>{customer.name}</div>
              <div className={styles.since}>{customer.since}</div>
            </div>
          </div>

          {customer.possibleDuplicate && (
            <div className={styles.dupWarning}>⚠ {t("possibleDuplicate")}</div>
          )}

          <div className={styles.contactList}>
            <div>
              <span className={styles.contactLabel}>{t("phone")}:</span>{" "}
              <span dir="ltr">{customer.phone ?? tCommon("na")}</span>
            </div>
            <div>
              <span className={styles.contactLabel}>{t("whatsapp")}:</span>{" "}
              <span dir="ltr">{customer.whatsapp ?? tCommon("na")}</span>
            </div>
            <div>
              <span className={styles.contactLabel}>{t("email")}:</span>{" "}
              <span dir="ltr">{customer.email ?? tCommon("na")}</span>
            </div>
            <div>
              <span className={styles.contactLabel}>{t("address")}:</span> {customer.address || tCommon("na")}
            </div>
            <div>
              <span className={styles.contactLabel}>{t("preferredContact")}:</span>{" "}
              {customer.preferredContact === "INTERNAL"
                ? tContact("internal")
                : customer.preferredContact
                  ? tActions(CONTACT_METHOD_ACTION_KEY[customer.preferredContact] as never)
                  : tCommon("na")}
            </div>
          </div>

          <div className={styles.statsRow}>
            <div>
              <div className={styles.statLabel}>{t("thOrders")}</div>
              <div className={styles.statValue} dir="ltr">
                {customer.orderCount}
              </div>
            </div>
            <div>
              <div className={styles.statLabel}>{t("thValue")}</div>
              <div className={styles.statValue} dir="ltr">
                {customer.lifetimeValue}
              </div>
            </div>
          </div>

          <div className={styles.contactActions} data-noprint="1">
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" className={styles.waBtn}>
                ✆ {tActions("whatsapp")}
              </a>
            )}
            {mailHref && (
              <a href={mailHref} className={styles.mailBtn}>
                ✉ {tActions("email")}
              </a>
            )}
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed rgba(35,32,27,.15)" }} data-noprint="1">
            <NotesPanel customerId={customer.id} initialNotes={customer.notes} />
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.panelLabel}>{t("orderHistory")}</div>
          {customer.orders.length === 0 && <div className={styles.emptyInline}>{t("noOrders")}</div>}
          {customer.orders.map((order) => (
            <Link key={order.id} href={`/admin/orders/${order.id}`} className={styles.orderRow}>
              <span className={styles.orderRef} dir="ltr">
                {order.ref}
              </span>
              <span className={styles.orderDate}>{order.date}</span>
              <OrderStatusPill status={order.status} />
              <span className={styles.orderTotal} dir="ltr">
                {order.total}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
