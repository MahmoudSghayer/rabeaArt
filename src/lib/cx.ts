export type ClassValue = string | false | null | undefined;

/** Minimal className joiner — avoids pulling in a dependency for something this small. */
export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
