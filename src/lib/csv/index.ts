/**
 * Hand-rolled CSV encoding for admin exports (orders/customers CSV downloads). No library
 * dependency — the format is simple enough to own outright, and it lets us bake in the
 * formula-injection mitigation described below directly at the encoding boundary.
 *
 * Loosely a port of store.js `csvCell`/`downloadCSV`, but every field is unconditionally
 * quoted here (simpler and equally valid per RFC 4180) rather than only quoting fields that
 * need it.
 */

/**
 * Characters that make Excel/Sheets/LibreOffice interpret a cell as a formula instead of
 * literal text: `=`, `+`, `-`, `@`, a leading tab, or a leading carriage return. CSV exports
 * embed customer-supplied text (names, notes) that an admin later opens in a spreadsheet app,
 * so any cell that *looks* like a formula is defused by prefixing it with a single quote —
 * spreadsheet apps render a leading `'` as "force text" and never execute it.
 */
const FORMULA_TRIGGER_CHARS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Prefixes `value` with `'` if it would otherwise be sniffed as a spreadsheet formula.
 *
 * Only leading ASCII spaces are stripped before the check (NOT a full `.trim()`) — a full trim
 * would strip leading tab/CR characters too, which are themselves two of the trigger characters
 * we need to detect, making that branch unreachable.
 */
export function sanitizeCell(value: string): string {
  const leadingSpacesStripped = value.replace(/^ +/, "");
  const startsWithTrigger = FORMULA_TRIGGER_CHARS.some((char) => leadingSpacesStripped.startsWith(char));
  return startsWithTrigger ? `'${value}` : value;
}

/**
 * Builds an RFC-4180-ish CSV string: every field is double-quoted, embedded `"` are doubled,
 * and rows are joined with CRLF (Excel's preferred line ending). `sanitizeCell` runs on every
 * cell before quoting.
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows];
  return allRows
    .map((row) => row.map((cell) => `"${sanitizeCell(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}

/** Prepends a UTF-8 BOM so Excel opens Arabic/Hebrew text correctly instead of mangling it. */
export function csvResponseBody(csv: string): string {
  return `﻿${csv}`;
}
