import "server-only";
import { getCachedSettings } from "@/lib/catalog/cached";
import { CONTACT_INFO } from "./contact-info";

/**
 * Resolves the studio's contact details from admin-managed Settings, falling back to the
 * hardcoded prototype values in contact-info.ts.
 *
 * This exists because the Settings model was never actually wired to the storefront: the footer
 * and the /contact page rendered `CONTACT_INFO` constants directly, so editing the WhatsApp
 * number or email in admin → Settings changed nothing a customer could see. The two most visible
 * places in the site were unreachable from the admin panel that claimed to own them.
 *
 * Falls back rather than throwing, matching how the storefront treats every other data failure:
 * a contact block showing a stale number is far better than a page that fails to render. Empty
 * strings fall back too — a blank WhatsApp number is worse than the placeholder, because a
 * customer with no way to reach the studio is a lost order.
 *
 * Cheap to call per page: getCachedSettings is tag-invalidated and hour-bounded, so this is one
 * cache read, not one query.
 */
export interface ResolvedContact {
  whatsapp: string;
  email: string;
  instagram: string;
  /** wa.me deep link, optionally pre-filling the chat. */
  waHref: (text?: string) => string;
  /** mailto: link, optionally pre-filling the subject. */
  mailHref: (subject?: string) => string;
}

function build(whatsapp: string, email: string, instagram: string): ResolvedContact {
  return {
    whatsapp,
    email,
    instagram,
    waHref: (text) => {
      const base = `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
      return text ? `${base}?text=${encodeURIComponent(text)}` : base;
    },
    mailHref: (subject) => {
      const base = `mailto:${email}`;
      return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
    },
  };
}

export async function resolveContactInfo(): Promise<ResolvedContact> {
  try {
    const settings = await getCachedSettings();
    return build(
      settings.whatsapp || CONTACT_INFO.whatsapp,
      settings.email || CONTACT_INFO.email,
      settings.instagram || CONTACT_INFO.instagram,
    );
  } catch {
    // Database unreachable — render the placeholders rather than failing the whole page.
    return build(CONTACT_INFO.whatsapp, CONTACT_INFO.email, CONTACT_INFO.instagram);
  }
}
