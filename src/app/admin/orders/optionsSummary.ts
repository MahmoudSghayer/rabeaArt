/**
 * Turns an `OrderItem.optionsJson` blob into a flat, orderable list of key/value pairs for
 * display. Shapes vary by item kind (see src/lib/orders/submit.ts): `{colorCode, sizeCode,
 * method}` for shirts, `{sizeCode, frameCode}` for paintings, and a free-form bag for CUSTOM_*
 * items — so this only assumes "a JSON object of scalar/array values", nothing more specific.
 * Keys are translated best-effort by the caller (see adminOptionKeys messages namespace); values
 * are shown raw, exactly as stored.
 */
export interface OptionEntry {
  key: string;
  value: string;
}

export function summarizeOptions(json: unknown): OptionEntry[] {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  return Object.entries(json as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => ({
      key,
      value: Array.isArray(value) ? value.map(String).join(", ") : String(value),
    }));
}
