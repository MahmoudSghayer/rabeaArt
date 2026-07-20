"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { setOrderArchivedAction } from "./actions";
import styles from "./orderDetail.module.css";

const CONFIRM_WINDOW_MS = 3000;

export interface DetailToolbarProps {
  orderId: string;
  archived: boolean;
}

/** Top toolbar of the order detail page: back link, print (window.print — the print CSS hides
 * all data-noprint chrome, see admin.module.css), per-order CSV export, and the archive toggle
 * with the mockup's two-click confirm pattern (first click arms, second within 3s commits). */
export function DetailToolbar({ orderId, archived }: DetailToolbarProps) {
  const t = useTranslations("adminOrderDetail");
  const tCommon = useTranslations("adminCommon");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  function onArchiveClick() {
    if (pending) return;
    if (!confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirming(false);
    startTransition(async () => {
      await setOrderArchivedAction(orderId, !archived);
    });
  }

  const archiveLabel = confirming
    ? tCommon(archived ? "confirmUnarchive" : "confirmArchive")
    : tCommon(archived ? "unarchive" : "archive");

  return (
    <div data-noprint="1" className={styles.toolbar}>
      <Link href="/admin/orders" className={styles.backBtn}>
        {tCommon("arrowBack")} {t("backToOrders")}
      </Link>
      <div className={styles.toolbarSpacer} />
      <button type="button" className={styles.toolBtn} onClick={() => window.print()}>
        ⎙ {tCommon("print")}
      </button>
      <a href={`/api/admin/orders/${orderId}/export`} className={styles.toolBtn}>
        {t("csvExport")}
      </a>
      <button type="button" className={styles.toolBtn} onClick={onArchiveClick} disabled={pending}>
        {archiveLabel}
      </button>
    </div>
  );
}
