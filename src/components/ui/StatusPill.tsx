import { useTranslations } from "next-intl";
import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_META, PAYMENT_STATUS_META } from "@/lib/orders/status";
import styles from "./StatusPill.module.css";

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const t = useTranslations("orderStatus");
  const meta = ORDER_STATUS_META[status];
  return (
    <span className={styles.pill} style={{ color: meta.fg, background: meta.bg }}>
      {t(meta.key as never)}
    </span>
  );
}

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  const t = useTranslations("paymentStatus");
  const meta = PAYMENT_STATUS_META[status];
  return (
    <span className={styles.pill} style={{ color: meta.fg, background: meta.bg }}>
      {t(meta.key as never)}
    </span>
  );
}
