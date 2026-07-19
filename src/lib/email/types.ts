/**
 * Provider-agnostic email types. Kept separate from `resend.ts` so `notify.ts` and templates
 * never import the Resend SDK directly — swapping providers later only touches this module's
 * implementers, not its callers.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type EmailSendResult = { ok: true; id: string } | { ok: false; error: string };

export interface EmailProvider {
  /** Never throws — network/API failures are reported via `{ ok: false, error }`. */
  send(msg: EmailMessage): Promise<EmailSendResult>;
}

/**
 * The five order-lifecycle notifications the studio sends. This is intentionally a small,
 * closed set (not every OrderStatus) — some transitions (e.g. NEEDS_INFO, PROGRESS) are handled
 * by the studio contacting the customer directly, not by an automated email.
 */
export type EmailTemplate =
  | "order-received"
  | "quotation-sent"
  | "order-accepted"
  | "order-declined"
  | "order-ready";
