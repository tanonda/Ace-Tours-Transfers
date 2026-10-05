import { describe, it, expect } from "vitest";
import { stashPendingCart, takePendingCart } from "./pending-cart";
import type { CartItem } from "./cart-context";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
}

const ITEM: CartItem = {
  cartItemId: "tour-1-123",
  id: "tour-1",
  title: "Blue Lagoon",
  price: 5000,
  childPrice: 2500,
  image: "/assets/products/blue-lagoon.webp",
  quantity: 1,
  date: new Date("2026-10-20T00:00:00Z"),
  adultPax: 2,
  childPax: 1,
  infantPax: 0,
  petPax: 0,
  slot: "09:00",
  type: "tour",
  addonIds: ["lunch"],
  addonTotal: 1500,
};

describe("pending cart", () => {
  it("gives back exactly the items stashed before leaving for the bank's page", () => {
    const storage = memoryStorage();
    stashPendingCart([ITEM], storage);
    expect(takePendingCart(storage)).toEqual([ITEM]);
  });

  it("can only be taken once, so the basket is not restored twice", () => {
    const storage = memoryStorage();
    stashPendingCart([ITEM], storage);
    takePendingCart(storage);
    expect(takePendingCart(storage)).toEqual([]);
  });

  it("returns nothing when nothing was stashed", () => {
    expect(takePendingCart(memoryStorage())).toEqual([]);
  });

  it("returns nothing, and clears it, when the stash is unreadable", () => {
    const storage = memoryStorage();
    storage.setItem("pendingCart", "{not json");
    expect(takePendingCart(storage)).toEqual([]);
    expect(storage.getItem("pendingCart")).toBeNull();
  });
});
