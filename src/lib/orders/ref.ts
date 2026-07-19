/**
 * Human-facing order reference formatting (e.g. "RA-1042"). The numeric sequence itself comes
 * from the DB (see the orders creation flow); this module only owns the string shape so the
 * format stays consistent between generation, display, and search/lookup parsing.
 */

const PREFIX = "RA-";

/** Formats a numeric order sequence as its public reference, e.g. `formatOrderRef(1042) === "RA-1042"`. */
export function formatOrderRef(n: number): string {
  return `${PREFIX}${n}`;
}

/** Matches a well-formed order ref exactly (e.g. for validating search input or route params). */
export const ORDER_REF_PATTERN = /^RA-\d+$/;
