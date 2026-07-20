"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { ORDER_STATUS_META } from "@/lib/orders/status";
import { ContactMethod, type OrderStatus } from "@/generated/prisma/enums";
import { formatMoney, initialOf, phoneDigits } from "@/components/admin/format";
import { recordWhatsappSentAction } from "./actions";
import type { OrderDetailData } from "./OrderDetailView";
import styles from "./orderDetail.module.css";

export interface CustomerCardProps {
  orderId: string;
  /** The order's public reference ("RA-1042") — named `orderRef` because `ref` is reserved by React. */
  orderRef: string;
  status: OrderStatus;
  finalPrice: number | null;
  contactMethod: ContactMethod;
  customer: OrderDetailData["customer"];
}

/** Single display line for a customer's postal address — every field is optional in the schema
 * (a customer may only have given a phone number so far), so this joins whatever is present. */
function composeAddress(customer: CustomerCardProps["customer"]): string {
  return [customer.street, customer.building, customer.apt, customer.city, customer.country, customer.postal]
    .filter(Boolean)
    .join(", ");
}

/** Maps a contact preference to the storefront's `actions.*` message key. INTERNAL is not a
 * customer-facing preference (schema-documented as CommunicationLog-only) — it falls back to the
 * `adminContactMethod.internal` label defensively rather than crashing on bad data. */
const CONTACT_METHOD_ACTION_KEY: Record<Exclude<ContactMethod, "INTERNAL">, string> = {
  [ContactMethod.PHONE]: "call",
  [ContactMethod.WHATSAPP]: "whatsapp",
  [ContactMethod.EMAIL]: "email",
};

export function CustomerCard({ orderId, orderRef, status, finalPrice, contactMethod, customer }: CustomerCardProps) {
  const t = useTranslations("adminOrderDetail");
  const tCommon = useTranslations("adminCommon");
  const tActions = useTranslations("actions");
  const tContact = useTranslations("adminContactMethod");
  const tStatus = useTranslations("orderStatus");

  // Localized WhatsApp draft (name / ref / current status / final price when set) — computed
  // once as the textarea's initial value; the admin edits it freely afterwards.
  const statusLabel = tStatus(ORDER_STATUS_META[status].key as never);
  const draftPriceLine =
    finalPrice !== null ? t("waDraftPriceLine", { price: formatMoney(finalPrice, "") }) : "";
  const initialDraft = t("waDraftTemplate", {
    name: customer.name,
    ref: orderRef,
    status: statusLabel,
    price: draftPriceLine,
  });

  const [copied, setCopied] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waText, setWaText] = useState(initialDraft);
  const [recorded, setRecorded] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copyPhone() {
    if (!customer.phone) return;
    try {
      await navigator.clipboard.writeText(customer.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (no permission, insecure context) — silently no-op, the phone
      // number is already visible in the panel for a manual copy.
    }
  }

  function recordSent() {
    if (pending) return;
    startTransition(async () => {
      const result = await recordWhatsappSentAction(orderId, waText);
      if (result.ok) {
        setRecorded(true);
        setTimeout(() => setRecorded(false), 3000);
      }
    });
  }

  const waNumber = customer.whatsapp || customer.phone || "";
  const waHref = waNumber ? `https://wa.me/${phoneDigits(waNumber)}?text=${encodeURIComponent(waText)}` : null;
  const mailHref = customer.email ? `mailto:${customer.email}` : null;

  return (
    <Card>
      <div className={styles.customerHead}>
        <span className={styles.avatar} aria-hidden="true">
          {initialOf(customer.name)}
        </span>
        <div>
          <div className={styles.customerName}>{customer.name}</div>
          <div className={styles.customerPref}>
            {t("contactPref")}:{" "}
            {contactMethod === ContactMethod.INTERNAL
              ? tContact("internal")
              : tActions(CONTACT_METHOD_ACTION_KEY[contactMethod] as never)}
          </div>
        </div>
      </div>

      <div className={styles.contactList}>
        <div>
          <span className={styles.contactLabel}>{t("phone")}:</span> <span dir="ltr">{customer.phone ?? tCommon("na")}</span>
          {customer.phone && (
            <button type="button" onClick={copyPhone} className={styles.copyBtn}>
              {copied ? tCommon("copied") : t("copyPhone")}
            </button>
          )}
        </div>
        <div>
          <span className={styles.contactLabel}>{t("whatsapp")}:</span>{" "}
          <span dir="ltr">{customer.whatsapp ?? tCommon("na")}</span>
        </div>
        <div>
          <span className={styles.contactLabel}>{t("email")}:</span> <span dir="ltr">{customer.email ?? tCommon("na")}</span>
        </div>
        <div>
          <span className={styles.contactLabel}>{t("address")}:</span> {composeAddress(customer) || tCommon("na")}
        </div>
        {customer.instructions && (
          <div>
            <span className={styles.contactLabel}>{t("deliveryInstructions")}:</span> {customer.instructions}
          </div>
        )}
      </div>

      <div className={styles.contactActions} data-noprint="1">
        <button type="button" className={styles.waBtn} onClick={() => setWaOpen((open) => !open)}>
          ✆ {t("waBtn")}
        </button>
        {mailHref && (
          <a href={mailHref} className={styles.mailBtn}>
            ✉ {t("emailBtn")}
          </a>
        )}
      </div>

      {waOpen && (
        <div className={styles.waPanel} data-noprint="1">
          <div className={styles.waPanelLabel}>{t("waDraftLabel")}</div>
          <textarea
            value={waText}
            onChange={(e) => setWaText(e.target.value)}
            rows={4}
            className={styles.waTextarea}
          />
          <div className={styles.waActions}>
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" className={styles.waOpenLink}>
                {t("waOpen")} ↗
              </a>
            )}
            <button type="button" className={styles.waRecordBtn} onClick={recordSent} disabled={pending}>
              {t("waRecordSent")}
            </button>
            {recorded && <span className={styles.waRecordedText}>✓ {t("waSentConfirmed")}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
