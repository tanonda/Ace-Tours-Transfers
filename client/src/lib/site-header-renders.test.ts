import { describe, it, expect, beforeAll, vi } from "vitest";
import { createElement } from "react";
import { installDom, mount, recordRenders } from "./test-dom";

let renders: Map<string, number>;
beforeAll(() => {
  installDom();
  renders = recordRenders(); // before react-dom loads
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  });
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

// The header holds 14 Radix navigation menus (~420 components). Signing-in state and
// the cart badge must re-render only the small pieces that show them.
describe("SiteHeader", () => {
  it("doesn't re-render when the sign-in check finishes or the cart changes", async () => {
    let finishAuthCheck!: () => void;
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (String(url).includes("/api/auth/me")) {
        return new Promise<Response>((resolve) => { finishAuthCheck = () => resolve(new Response(null, { status: 401 })); });
      }
      return Promise.resolve(Response.json([]));
    }));
    await import("./i18n");
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const { AuthProvider } = await import("./auth-context");
    const { CartProvider, useCartActions } = await import("./cart-context");
    const { CurrencyProvider } = await import("./currency-context");
    const { ThemeProvider } = await import("./theme-context");
    const { TooltipProvider } = await import("@/components/ui/tooltip");
    const { SiteHeader } = await import("@/components/layout");

    let addToCart!: ReturnType<typeof useCartActions>["addToCart"];
    const AddButton = () => {
      addToCart = useCartActions().addToCart;
      return null;
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = createElement(QueryClientProvider, { client },
      createElement(ThemeProvider, null,
        createElement(TooltipProvider, null,
          createElement(AuthProvider, null,
            createElement(CurrencyProvider, null,
              createElement(CartProvider, null, createElement(SiteHeader), createElement(AddButton)))))));
    const { container, act } = await mount(tree);
    // Let the header's own queries (products, settings) land first: re-rendering for
    // new data is expected; only auth and cart updates are under test.
    await vi.waitFor(() => expect(client.isFetching()).toBe(0));
    await act(async () => {});
    renders.clear();
    // The bundler may rename the function (e.g. SiteHeader2) to avoid a name clash.
    const headerRenders = () => [...renders].filter(([name]) => /^SiteHeader\d*$/.test(name)).reduce((n, [, c]) => n + c, 0);

    await act(async () => finishAuthCheck());
    const afterSignInCheck = headerRenders();
    await act(async () =>
      addToCart({ id: "t1", type: "tour", title: "Blue Lagoon", price: 9000, childPrice: 0, image: "", adultPax: 1, childPax: 0, infantPax: 0, petPax: 0 }),
    );

    expect(container.textContent).toContain("Cart (1)");
    expect(afterSignInCheck).toBe(0);
    expect(headerRenders()).toBe(0);
  });
});
