import "server-only";
import { Resend } from "resend";
import { getOptionalEnv } from "@/lib/env";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

/**
 * Used whenever email is disabled (missing RESEND_API_KEY/EMAIL_FROM — see lib/env.ts). Every
 * send reports `EMAIL_DISABLED` rather than throwing, so callers (see notify.ts) can still write
 * a "failed" EmailLog row and move on — local/dev/preview environments never need real Resend
 * credentials just to exercise the order flow.
 */
class NoopEmailProvider implements EmailProvider {
  async send(): Promise<EmailSendResult> {
    return { ok: false, error: "EMAIL_DISABLED" };
  }
}

class ResendProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: this.from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      // The SDK can return a non-null `data` alongside no id in edge cases — never report `ok`
      // without an actual provider message id to point to.
      if (error || !data?.id) {
        return { ok: false, error: error?.message ?? "UNKNOWN_ERROR" };
      }
      return { ok: true, id: data.id };
    } catch (err) {
      // The SDK can also throw outright (network errors, etc.) — this must never propagate as
      // an unhandled rejection / 500 for the caller.
      return { ok: false, error: err instanceof Error ? err.message : "UNKNOWN_ERROR" };
    }
  }
}

let cachedProvider: EmailProvider | null = null;

/**
 * Returns the process-wide email provider, constructing it lazily (and only once) on first use.
 * Laziness matters: `getOptionalEnv()` must never be evaluated at module-load time in a way that
 * could affect app startup — RESEND_API_KEY is optional by design (see lib/env.ts).
 */
export function getEmailProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider;
  const env = getOptionalEnv();
  cachedProvider =
    env.emailEnabled && env.RESEND_API_KEY && env.EMAIL_FROM
      ? new ResendProvider(env.RESEND_API_KEY, env.EMAIL_FROM)
      : new NoopEmailProvider();
  return cachedProvider;
}
