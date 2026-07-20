"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/components/admin/format";
import type { SupportedLocale } from "@/i18n/routing";
import { addInternalNoteAction } from "./actions";
import styles from "./orderDetail.module.css";

export interface InternalNote {
  id: string;
  text: string;
  byName: string;
  at: string;
}

/** Append-only internal notes (CommunicationLog rows with `channel: INTERNAL`, never shown to
 * the customer — see requireRole(STAFF) in addInternalNoteAction). Relies on the action's
 * `revalidatePath` to refresh `notes` via a fresh server render rather than local optimistic
 * state, keeping this the single source of truth. */
export function InternalNotesPanel({ orderId, notes }: { orderId: string; notes: InternalNote[] }) {
  const t = useTranslations("adminOrderDetail");
  const tCommon = useTranslations("adminCommon");
  const locale = useLocale() as SupportedLocale;
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function submit() {
    const value = text.trim();
    if (!value || pending) return;
    setError(false);
    startTransition(async () => {
      const result = await addInternalNoteAction(orderId, value);
      if (result.ok) setText("");
      else setError(true);
    });
  }

  return (
    <Card>
      <div className={styles.panelLabel}>{t("internalNotesTitle")}</div>
      {notes.length === 0 && <div className={styles.emptyInline}>{t("noNotes")}</div>}
      {notes.map((n) => (
        <div key={n.id} className={styles.noteRow}>
          <div className={styles.noteText}>{n.text}</div>
          <div className={styles.noteMeta}>
            {n.byName} · {formatDateTime(n.at, locale)}
          </div>
        </div>
      ))}
      <div className={styles.noteForm}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("addNotePlaceholder")}
          className={styles.noteInput}
          disabled={pending}
        />
        <Button type="button" size="sm" onClick={submit} disabled={pending || !text.trim()}>
          {tCommon("add")}
        </Button>
      </div>
      {error && <div className={styles.errorText}>{tCommon("errorGeneric")}</div>}
    </Card>
  );
}
