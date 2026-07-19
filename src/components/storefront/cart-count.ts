/**
 * Stub for the storefront cart badge. Returns 0 for now — the cart/order agent building the
 * order flow (localStorage or server-backed cart) will replace the internals of this hook with
 * real state. Keep the exported signature (`useCartCount(): number`) stable so SiteHeader never
 * needs to change when that lands.
 */
export function useCartCount(): number {
  return 0;
}
