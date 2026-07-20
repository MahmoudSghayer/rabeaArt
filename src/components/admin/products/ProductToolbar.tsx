"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { deleteProductAction, setArchivedAction } from "@/app/admin/products/actions";
import styles from "./ProductForm.module.css";

const CONFIRM_WINDOW_MS = 3000;

export interface ProductToolbarProps {
  productId: string;
  archived: boolean;
  /** Delete is hidden entirely once the product has any OrderItems — never hard-deleted once it
   * has real order history (see actions.ts's deleteProductAction, which re-checks this itself). */
  hasOrderItems: boolean;
}

/** Top toolbar of the product edit page: back link, Archive/Unarchive and Delete, both using the
 * admin's established two-click confirm pattern (see orders/[id]/DetailToolbar.tsx). */
export function ProductToolbar({ productId, archived, hasOrderItems }: ProductToolbarProps) {
  const router = useRouter();
  const t = useTranslations("adminProductForm");
  const tCommon = useTranslations("adminCommon");

  const [archiveConfirming, setArchiveConfirming] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const archiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (archiveTimer.current) clearTimeout(archiveTimer.current);
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    };
  }, []);

  function onArchiveClick() {
    if (pending) return;
    if (!archiveConfirming) {
      setArchiveConfirming(true);
      archiveTimer.current = setTimeout(() => setArchiveConfirming(false), CONFIRM_WINDOW_MS);
      return;
    }
    if (archiveTimer.current) clearTimeout(archiveTimer.current);
    setArchiveConfirming(false);
    startTransition(async () => {
      await setArchivedAction(productId, !archived);
    });
  }

  function onDeleteClick() {
    if (pending) return;
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      deleteTimer.current = setTimeout(() => setDeleteConfirming(false), CONFIRM_WINDOW_MS);
      return;
    }
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    setDeleteConfirming(false);
    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (result.ok) router.replace("/admin/products");
    });
  }

  const archiveLabel = archiveConfirming
    ? tCommon(archived ? "confirmUnarchive" : "confirmArchive")
    : tCommon(archived ? "unarchive" : "archive");
  const deleteLabel = deleteConfirming ? t("confirmDelete") : t("delete");

  return (
    <div className={styles.toolbar}>
      <Link href="/admin/products" className={styles.backBtn}>
        {tCommon("arrowBack")} {t("backToProducts")}
      </Link>
      <div className={styles.toolbarSpacer} />
      <button type="button" className={styles.toolBtn} onClick={onArchiveClick} disabled={pending}>
        {archiveLabel}
      </button>
      {!hasOrderItems && (
        <button type="button" className={styles.toolBtnDanger} onClick={onDeleteClick} disabled={pending}>
          {deleteLabel}
        </button>
      )}
    </div>
  );
}
