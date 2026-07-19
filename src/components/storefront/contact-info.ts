/**
 * Prototype contact defaults, ported verbatim from `_design-reference/store.js`
 * (`getSettings()`). These are hardcoded placeholders — once the Settings model
 * (see prisma/schema.prisma) is wired up, admin-managed settings replace this file.
 */
export const CONTACT_INFO = {
  whatsapp: "+972 50 000 0000",
  email: "hello@rabea.art",
  instagram: "@rabea.art",
} as const;

/** Digits-only phone number, suitable for a wa.me deep link. */
function whatsappDigits(): string {
  return CONTACT_INFO.whatsapp.replace(/\D/g, "");
}

/** Builds a wa.me deep link, optionally pre-filling the chat with `text`. */
export function whatsappHref(text?: string): string {
  const base = `https://wa.me/${whatsappDigits()}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Builds a mailto: link, optionally pre-filling the subject line. */
export function mailHref(subject?: string): string {
  const base = `mailto:${CONTACT_INFO.email}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}
