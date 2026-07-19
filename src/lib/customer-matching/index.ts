import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normalizes a raw phone number to E.164 (e.g. "+972501234567") using libphonenumber-js.
 * `defaultRegion` resolves local-format numbers (e.g. "050-123-4567") — most of Rabea.art's
 * customers are in Israel/Palestine, hence the "IL" default. Never throws: unparseable or
 * empty input returns null so callers can fall back to storing the raw string only.
 */
export function normalizePhone(raw: string, defaultRegion: string = "IL"): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultRegion as CountryCode);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.number;
  } catch {
    // libphonenumber-js throws on some malformed input rather than returning undefined.
    return null;
  }
}

/**
 * Normalizes an email to a lowercase, trimmed form, or null if it's empty or doesn't have a
 * plausible email shape. Intentionally simple (not RFC 5322-complete) — this only feeds
 * customer de-duplication, not delivery, so a loose check is enough.
 */
export function normalizeEmail(raw: string): string | null {
  const trimmed = raw?.trim().toLowerCase();
  if (!trimmed) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

export interface CustomerMatchInput {
  phoneNormalized: string | null;
  emailNormalized: string | null;
}

export interface CustomerMatchCandidate {
  id: string;
  phoneNormalized: string | null;
  emailNormalized: string | null;
}

export type CustomerMatchResult =
  | { kind: "match"; id: string }
  | { kind: "new" }
  | { kind: "conflict"; phoneMatchId: string; emailMatchId: string };

/**
 * Pure decision function for order-time customer matching — no DB access. Exact phone match
 * wins over exact email match. If phone and email each hit a *different* existing customer,
 * that's a conflict: the caller must create a new customer record and flag it for admin
 * review rather than silently merging two people who happen to share partial contact info.
 */
export function decideCustomerMatch(
  input: CustomerMatchInput,
  candidates: CustomerMatchCandidate[],
): CustomerMatchResult {
  const phoneMatch = input.phoneNormalized
    ? candidates.find((c) => c.phoneNormalized === input.phoneNormalized)
    : undefined;
  const emailMatch = input.emailNormalized
    ? candidates.find((c) => c.emailNormalized === input.emailNormalized)
    : undefined;

  if (phoneMatch && emailMatch && phoneMatch.id !== emailMatch.id) {
    return { kind: "conflict", phoneMatchId: phoneMatch.id, emailMatchId: emailMatch.id };
  }
  if (phoneMatch) return { kind: "match", id: phoneMatch.id };
  if (emailMatch) return { kind: "match", id: emailMatch.id };
  return { kind: "new" };
}
