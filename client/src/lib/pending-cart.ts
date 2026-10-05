import type { CartItem } from "./cart-context";

// The basket is emptied when a guest leaves for a bank's hosted payment page.
// A copy is kept here so the cancel page can put it back if the payment is
// cancelled or declined; the success page discards it.
const PENDING_CART_KEY = "pendingCart";

export function stashPendingCart(items: CartItem[], storage: Storage = localStorage): void {
  try {
    storage.setItem(PENDING_CART_KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked: the guest can still rebuild the basket by hand.
  }
}

export function takePendingCart(storage: Storage = localStorage): CartItem[] {
  try {
    const stored = storage.getItem(PENDING_CART_KEY);
    if (!stored) return [];
    const items: CartItem[] = JSON.parse(stored);
    return items.map((item) => ({ ...item, date: item.date ? new Date(item.date) : undefined }));
  } catch {
    return [];
  } finally {
    try { storage.removeItem(PENDING_CART_KEY); } catch { /* ignore */ }
  }
}
