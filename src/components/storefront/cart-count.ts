/**
 * Storefront cart badge hook — thin re-export so SiteHeader stays decoupled from the cart
 * store's module location. Real state lives in src/lib/cart/store.ts (Zustand, localStorage).
 */
export { useCartCount } from "@/lib/cart/store";
