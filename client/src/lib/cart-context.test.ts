import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { createElement } from "react";
import { installDom, mount } from "./test-dom";

beforeAll(installDom);
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
});

describe("CartProvider renders", () => {
  it("doesn't re-render cart readers when an empty cart is restored on mount", async () => {
    const { CartProvider, useCart } = await import("./cart-context");
    let renders = 0;
    const Badge = () => {
      renders++;
      return createElement("span", null, useCart().itemCount);
    };
    await mount(createElement(CartProvider, null, createElement(Badge)));
    expect(renders).toBe(1);
  });

  it("never re-renders components that only use the cart actions", async () => {
    const { CartProvider, useCart, useCartActions } = await import("./cart-context");
    let actionRenders = 0;
    let add: ReturnType<typeof useCartActions>["addToCart"] | undefined;
    const BookButton = () => {
      actionRenders++;
      add = useCartActions().addToCart;
      return null;
    };
    const Badge = () => createElement("span", { id: "badge" }, useCart().itemCount);
    const { container, act } = await mount(
      createElement(CartProvider, null, createElement(BookButton), createElement(Badge)),
    );
    await act(async () =>
      add!({ id: "tour-1", type: "tour", title: "Blue Lagoon", price: 9000, childPrice: 4500, image: "", adultPax: 2, childPax: 0, infantPax: 0, petPax: 0 }),
    );
    expect(container.querySelector("#badge")!.textContent).toBe("1");
    expect(actionRenders).toBe(1);
  });
});
