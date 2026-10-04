import { describe, it, expect, beforeAll } from "vitest";
import { createElement, Suspense, startTransition, useEffect } from "react";
import { installDom } from "./test-dom";

beforeAll(installDom);

// React commits the root first and hydrates <Suspense> content in a later pass, so a
// "hydration finished" signal has to live inside the route boundary.
describe("RouteCommitted", () => {
  it("resolves only after the route content inside <Suspense> has hydrated", async () => {
    const { renderToString } = await import("react-dom/server");
    const { hydrateRoot } = await import("react-dom/client");
    const { RouteCommitted, routeContentCommitted } = await import("./route-committed");

    let contentHydrated = false;
    const Page = () => {
      useEffect(() => {
        contentHydrated = true;
      }, []);
      return createElement("h1", null, "Private Bus Hire");
    };
    const tree = () =>
      createElement("div", null, createElement("header", null, "Ace Tours"),
        createElement(Suspense, { fallback: createElement("p", null, "loading") },
          createElement(Page), createElement(RouteCommitted)));

    const root = document.createElement("div");
    document.body.append(root);
    root.innerHTML = renderToString(tree());

    startTransition(() => {
      hydrateRoot(root, tree());
    });
    await routeContentCommitted;
    expect(contentHydrated).toBe(true);
    expect(root.querySelector("h1")!.textContent).toBe("Private Bus Hire");
  });
});
