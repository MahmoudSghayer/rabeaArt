"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_FLOW, ORDER_STATUS_META, PAYMENT_STATUS_META } from "@/lib/orders/status";
import {
  updateEtaAction,
  updateFinalPriceAction,
  updateOrderPayAction,
  updateOrderStatusAction,
} from "./actions";
import styles from "./orderDetail.module.css";

const PAY_OPTIONS = Object.values(PaymentStatus);

export interface ManagePanelProps {
  orderId: string;
  status: OrderStatus;
  pay: PaymentStatus;
  finalPrice: number | null;
  /** `YYYY-MM-DD` or null. */
  eta: string | null;
}

/**
 * The "Manage order" panel: status / pay selects and final-price / ETA inputs, each auto-saving
 * through its own Server Action (see actions.ts — every action re-checks the role server-side).
 * On a failed status change (invalid transition, stock shortage) the select snaps back to the
 * server-confirmed value and the error — including the short-item list from InventoryError —
 * renders under the field.
 */
export function ManagePanel({ orderId, status, pay, finalPrice, eta }: ManagePanelProps) {
  const t = useTranslations("adminOrderDetail");
  const tCommon = useTranslations("adminCommon");
  const tStatus = useTranslations("orderStatus");
  const tPay = useTranslations("paymentStatus");

  const [pending, startTransition] = useTransition();
  const [statusValue, setStatusValue] = useState(status);
  const [payValue, setPayValue] = useState(pay);
  const [priceValue, setPriceValue] = useState(finalPrice === null ? "" : String(finalPrice));
  const [etaValue, setEtaValue] = useState(eta ?? "");
  const [error, setError] = useState<string | null>(null);

  function changeStatus(next: OrderStatus) {
    setStatusValue(next);
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatusAction(orderId, next);
      if (!result.ok) {
        setStatusValue(status);
        setError(
          result.error === "STOCK_SHORTAGE"
            ? `${t("stockErrorTitle")}${result.details ? ` — ${result.details}` : ""}`
            : t("transitionError"),
        );
      }
    });
  }

  function changePay(next: PaymentStatus) {
    setPayValue(next);
    setError(null);
    startTransition(async () => {
      const result = await updateOrderPayAction(orderId, next);
      if (!result.ok) {
        setPayValue(pay);
        setError(t("saveError"));
      }
    });
  }

  function savePrice() {
    const trimmed = priceValue.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError(t("saveError"));
      return;
    }
    // No-op when unchanged — onBlur fires on every focus loss, not just edits.
    if (parsed === finalPrice) return;
    setError(null);
    startTransition(async () => {
      const result = await updateFinalPriceAction(orderId, parsed);
      if (!result.ok) {
        setPriceValue(finalPrice === null ? "" : String(finalPrice));
        setError(t("saveError"));
      }
    });
  }

  function saveEta(next: string) {
    setEtaValue(next);
    if ((next || null) === eta) return;
    setError(null);
    startTransition(async () => {
      const result = await updateEtaAction(orderId, next || null);
      if (!result.ok) {
        setEtaValue(eta ?? "");
        setError(t("saveError"));
      }
    });
  }

  return (
    <Card data-noprint="1">
      <div className={styles.manageForm}>
        <div className={styles.panelLabel} style={{ marginBottom: 0 }}>
          {t("manageTitle")}
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("statusLabel")}</span>
          <select
            value={statusValue}
            onChange={(e) => changeStatus(e.target.value as OrderStatus)}
            className={styles.select}
            disabled={pending}
          >
            {ORDER_STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {tStatus(ORDER_STATUS_META[s].key as never)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("payLabel")}</span>
          <select
            value={payValue}
            onChange={(e) => changePay(e.target.value as PaymentStatus)}
            className={styles.select}
            disabled={pending}
          >
            {PAY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {tPay(PAYMENT_STATUS_META[p].key as never)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            {t("finalPriceLabel")} ({tCommon("currency")})
          </span>
          <input
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
            onBlur={savePrice}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            inputMode="numeric"
            dir="ltr"
            placeholder={tCommon("na")}
            className={styles.textInput}
            disabled={pending}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("etaLabel")}</span>
          <input
            type="date"
            value={etaValue}
            onChange={(e) => saveEta(e.target.value)}
            dir="ltr"
            className={styles.textInput}
            disabled={pending}
          />
        </label>

        {pending ? (
          <div className={styles.savingHint}>{tCommon("saving")}</div>
        ) : (
          <div className={styles.autoSaveHint}>{t("autoSaveHint")}</div>
        )}
        {error && <div className={styles.errorText}>{error}</div>}
      </div>
    </Card>
  );
}
