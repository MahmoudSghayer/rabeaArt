"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OrderItemInput } from "@/lib/orders/schemas";
import type { AllowedUploadMime } from "@/lib/storage/validation";

/**
 * Client-side cart cache only — nothing here is authoritative. Every price shown is a display
 * hint (`unitPrice`); the server always re-derives real prices from a fresh DB read at submit
 * time (see src/lib/orders/submit.ts), so a stale/tampered localStorage value can never affect
 * what an order actually costs.
 */

/** A file staged via the signed-upload flow (see src/lib/storage/uploads.ts), waiting to be
 * attached to a custom order item on submit. `bucketPath` is already the full
 * "order-uploads/…" form the order schemas validate (see schemas.ts's customFileSchema). */
export type StagedFile = {
  bucketPath: string;
  originalName: string;
  mimeType: AllowedUploadMime;
  size: number;
  /** Client-only display sugar (a data: URL thumbnail) — never sent to the server; stripped by
   * getCartSnapshotForSubmit below. */
  previewDataUrl?: string;
};

export type ShirtCartItem = {
  kind: "shirt";
  key: string;
  productId: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  colorCode: string;
  sizeCode: string;
  method: "print" | "embroidery" | null;
  qty: number;
  /** Display hint only — see module doc comment. */
  unitPrice: number | null;
  notes: string;
};

export type PaintingCartItem = {
  kind: "painting";
  key: string;
  productId: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  sizeCode: string;
  frameCode: string;
  qty: number;
  /** Display hint only — see module doc comment. */
  unitPrice: number | null;
  notes: string;
};

export type CustomCartItemKind = "custom-shirt" | "custom-painting" | "custom-other";

export type CustomCartItem = {
  kind: CustomCartItemKind;
  key: string;
  labelAr: string;
  labelEn: string;
  qty: number;
  /** Always null — custom items are always manually priced by the studio. */
  unitPrice: null;
  options: Record<string, string | string[]>;
  notes: string;
  files: StagedFile[];
};

export type CartItem = ShirtCartItem | PaintingCartItem | CustomCartItem;

/** `T extends unknown ? … : never` forces the mapped type to distribute over each member of the
 * `CartItem` union independently, instead of collapsing to only the fields common to all three
 * variants (which is what a plain `Omit<CartItem, K>`/`Partial<CartItem>` would do). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type DistributivePartial<T> = T extends unknown ? Partial<T> : never;

/** Shape accepted by `addItem` — everything except the store-generated `key`. */
export type NewCartItem = DistributiveOmit<CartItem, "key">;
/** Shape accepted by `updateItem` — a partial patch of any one variant, never re-targeting `key`. */
export type CartItemPatch = DistributiveOmit<DistributivePartial<CartItem>, "key">;

const QTY_MIN = 1;
const QTY_MAX = 30;

function clampQty(qty: number): number {
  return Math.min(QTY_MAX, Math.max(QTY_MIN, Math.round(qty)));
}

type CartState = {
  items: CartItem[];
  /** Returns the generated key so the caller (e.g. an "added to cart" toast with an undo action)
   * can reference the new item without re-deriving it. */
  addItem: (item: NewCartItem) => string;
  removeItem: (key: string) => void;
  updateQty: (key: string, qty: number) => void;
  updateItem: (key: string, patch: CartItemPatch) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => {
        const key = crypto.randomUUID();
        set((state) => ({ items: [...state.items, { ...item, key } as CartItem] }));
        return key;
      },
      removeItem: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      updateQty: (key, qty) =>
        set((state) => ({
          items: state.items.map((i) => (i.key === key ? { ...i, qty: clampQty(qty) } : i)),
        })),
      updateItem: (key, patch) =>
        set((state) => ({
          items: state.items.map((i) => (i.key === key ? ({ ...i, ...patch } as CartItem) : i)),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "rabea_cart", version: 1 },
  ),
);

/** Sum of `qty` across every cart item. Matches the `useCartCount(): number` signature of the
 * SiteHeader stub at src/components/storefront/cart-count.ts, which the orchestrator will
 * re-point at this once the storefront cart UI lands. */
export function useCartCount(): number {
  return useCartStore((state) => state.items.reduce((sum, item) => sum + item.qty, 0));
}

export function useCartItems(): CartItem[] {
  return useCartStore((state) => state.items);
}

/**
 * Pure conversion from cart items to the `/api/orders` submission shape (`orderItemSchema` in
 * @/lib/orders/schemas). Strips client-only fields (`previewDataUrl`) and drops every price —
 * the server reprices authoritatively, so nothing here is trusted input, only a UI convenience.
 */
export function getCartSnapshotForSubmit(items: CartItem[]): OrderItemInput[] {
  return items.map((item): OrderItemInput => {
    if (item.kind === "shirt") {
      return {
        kind: "shirt",
        productId: item.productId,
        colorCode: item.colorCode,
        sizeCode: item.sizeCode,
        method: item.method,
        qty: item.qty,
        notes: item.notes,
      };
    }
    if (item.kind === "painting") {
      return {
        kind: "painting",
        productId: item.productId,
        sizeCode: item.sizeCode,
        frameCode: item.frameCode,
        qty: item.qty,
        notes: item.notes,
      };
    }
    return {
      kind: item.kind,
      options: item.options,
      qty: item.qty,
      notes: item.notes,
      files: item.files.map((f) => ({
        bucketPath: f.bucketPath,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
      })),
    };
  });
}
