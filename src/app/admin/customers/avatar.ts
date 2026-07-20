/**
 * Avatar-circle background colors for the customers list/detail — ports the design reference's
 * 5-color rotation (`_design-reference/Admin.dc.html`, `avs=['#B7472A','#33605A','#C99B3F',
 * '#3E5C8A','#7C5286']`). Kept local to `admin/customers/**` (rather than added to
 * `components/admin/format.ts`, which is shared/owned by the admin-core workstream) per the
 * parallel-workstream file-ownership rules in AGENTS.md — "reuse/extend format.ts helpers pattern
 * INSIDE your own files".
 */
const AVATAR_COLORS = ["#B7472A", "#33605A", "#C99B3F", "#3E5C8A", "#7C5286"];

/** Positional rotation for list rows (matches the design reference exactly: `avs[i % 5]`). */
export function avatarColorForIndex(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

/** Stable per-customer color for the detail page (no "row index" exists there) — a simple string
 * hash mod 5, same technique as `artKeyForId` in components/admin/format.ts. */
export function avatarColorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
