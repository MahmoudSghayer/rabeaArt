"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateCustomerNotesAction } from "./actions";
import styles from "./customerDetail.module.css";

/** Internal-notes textarea for a customer — unlike the order detail's append-only
 * `InternalNotesPanel` (a `CommunicationLog`), `Customer.notes` is a single free-text field: this
 * edits and saves the whole value via an explicit Save button rather than auto-saving on every
 * keystroke or blur, since a large textarea mid-sentence shouldn't fire a write per pause. */
export function NotesPanel({ customerId, initialNotes }: { customerId: string; initialNotes: string }) {
  const t = useTranslations("adminCustomers");
  const tCommon = useTranslations("adminCommon");
  const [text, setText] = useState(initialNotes);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  const dirty = text !== initialNotes;

  function save() {
    if (pending || !dirty) return;
    setError(false);
    setSaved(false);
    startTransition(async () => {
      const result = await updateCustomerNotesAction(customerId, text);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(true);
      }
    });
  }

  return (
    <div>
      <div className={styles.panelLabel}>{t("notesTitle")}</div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder={t("notesPlaceholder")}
        className={styles.notesTextarea}
        disabled={pending}
      />
      <div className={styles.notesActions}>
        <button type="button" className={styles.saveBtn} onClick={save} disabled={pending || !dirty}>
          {pending ? tCommon("saving") : tCommon("save")}
        </button>
        {saved && <span className={styles.savedText}>✓ {tCommon("saved")}</span>}
      </div>
      {error && <div className={styles.errorText}>{tCommon("errorGeneric")}</div>}
    </div>
  );
}
