"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AdminRole } from "@/generated/prisma/enums";
import { cx } from "@/lib/cx";
import { changeAdminRoleAction, inviteAdminUserAction, setAdminUserActiveAction } from "./actions";
import { ROLE_FLOW, ROLE_META } from "./roleMeta";
import styles from "./users.module.css";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  avatarColor: string;
};

const CONFIRM_WINDOW_MS = 3000;

/** One table row — its own local state for the role select / deactivate-toggle so a slow save on
 * one admin never blocks or flashes another row (mirrors the per-row local state pattern used
 * throughout the order-detail panels, e.g. `ManagePanel.tsx`'s snap-back-on-failure). */
function UserRow({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  const t = useTranslations("adminUsers");
  const tCommon = useTranslations("adminCommon");
  const tRole = useTranslations("adminRoles");

  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  function changeRole(next: AdminRole) {
    const prev = role;
    setRole(next);
    setError(null);
    startTransition(async () => {
      const result = await changeAdminRoleAction(user.id, next);
      if (!result.ok) {
        setRole(prev);
        setError(result.error === "LAST_OWNER" ? t("lastOwnerError") : t("actionError"));
      }
    });
  }

  function onToggleClick() {
    if (pending) return;
    if (!confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), CONFIRM_WINDOW_MS);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirming(false);
    const next = !active;
    setError(null);
    startTransition(async () => {
      const result = await setAdminUserActiveAction(user.id, next);
      if (result.ok) {
        setActive(next);
      } else {
        setError(result.error === "LAST_OWNER" ? t("lastOwnerError") : t("actionError"));
      }
    });
  }

  const toggleLabel = confirming
    ? tCommon(active ? "confirmArchive" : "confirmUnarchive")
    : t(active ? "deactivate" : "reactivate");

  return (
    <div className={cx(styles.row, !active && styles.rowInactive)}>
      <span className={styles.nameCell}>
        <span className={styles.avatar} style={{ background: user.avatarColor }} aria-hidden="true">
          {[...user.name.trim()][0]?.toUpperCase() ?? "?"}
        </span>
        <span className={styles.name}>
          {user.name}
          {isSelf ? ` (${t("you")})` : ""}
        </span>
      </span>
      <span className={styles.email} dir="ltr">
        {user.email}
      </span>
      <span>
        <select
          value={role}
          onChange={(e) => changeRole(e.target.value as AdminRole)}
          className={styles.roleSelect}
          disabled={pending}
        >
          {ROLE_FLOW.map((r) => (
            <option key={r} value={r}>
              {tRole(ROLE_META[r].key as never)}
            </option>
          ))}
        </select>
      </span>
      <span className={active ? styles.statusActive : styles.statusInactive}>
        {active ? t("active") : t("deactivated")}
      </span>
      <span className={styles.metaText}>{user.lastLoginAt ?? tCommon("na")}</span>
      <span className={styles.metaText}>{user.createdAt}</span>
      <span className={styles.rowActions}>
        <button type="button" className={styles.toggleBtn} onClick={onToggleClick} disabled={pending}>
          {toggleLabel}
        </button>
      </span>
      {error && <div className={styles.rowError}>{error}</div>}
    </div>
  );
}

function InviteForm() {
  const t = useTranslations("adminUsers");
  const tRole = useTranslations("adminRoles");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>(AdminRole.STAFF);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  function submit() {
    if (pending || !email.trim() || !name.trim()) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await inviteAdminUserAction({ email: email.trim(), name: name.trim(), role });
      if (result.ok) {
        setFeedback({ ok: true, message: t("inviteSuccess") });
        setEmail("");
        setName("");
        setRole(AdminRole.STAFF);
      } else {
        const message = result.error === "EMAIL_TAKEN" ? t("emailTaken") : t("inviteFailed");
        setFeedback({ ok: false, message });
      }
    });
  }

  return (
    <div className={styles.inviteCard}>
      <div className={styles.inviteTitle}>{t("inviteTitle")}</div>
      <div className={styles.inviteForm}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("nameLabel")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={styles.input} disabled={pending} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("emailLabel")}</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            dir="ltr"
            className={styles.input}
            disabled={pending}
          />
        </label>
        <label className={styles.field} style={{ flex: "none", minWidth: 140 }}>
          <span className={styles.fieldLabel}>{t("roleLabel")}</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className={styles.select}
            disabled={pending}
          >
            {ROLE_FLOW.map((r) => (
              <option key={r} value={r}>
                {tRole(ROLE_META[r].key as never)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.inviteBtn} onClick={submit} disabled={pending || !email.trim() || !name.trim()}>
          {pending ? t("inviting") : t("inviteBtn")}
        </button>
      </div>
      {feedback && (
        <div className={cx(styles.inviteFeedback, feedback.ok ? styles.inviteSuccess : styles.inviteError)}>
          {feedback.message}
        </div>
      )}
    </div>
  );
}

export function UsersView({ users, currentAdminId }: { users: AdminUserRow[]; currentAdminId: string }) {
  const t = useTranslations("adminUsers");

  return (
    <>
      <InviteForm />

      <div className={styles.tableWrap}>
        <div className={styles.tableInner}>
          <div className={styles.headRow}>
            <span>{t("thName")}</span>
            <span>{t("thEmail")}</span>
            <span>{t("thRole")}</span>
            <span>{t("thStatus")}</span>
            <span>{t("thLastLogin")}</span>
            <span>{t("thCreated")}</span>
            <span>{t("thActions")}</span>
          </div>
          {users.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === currentAdminId} />
          ))}
        </div>
      </div>
      {users.length === 0 && <div className={styles.empty}>{t("noUsers")}</div>}
    </>
  );
}
