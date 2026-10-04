import { describe, it, expect, beforeAll } from "vitest";
import { createElement, useId } from "react";
// @ts-ignore - jsdom ships no type declarations
import { JSDOM } from "jsdom";

// The prerender's renderToString output and the client's hydrateRoot tree must have
// the same shape, or every useId (Radix aria-controls, labels, …) differs.
describe("renderSnapshot", () => {
  beforeAll(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>');
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      Node: dom.window.Node,
      HTMLElement: dom.window.HTMLElement,
      HTMLIFrameElement: dom.window.HTMLIFrameElement,
    });
  });

  it("produces markup that hydrates with matching useId values", async () => {
    let clientId = "";
    const Probe = () => {
      const id = useId();
      if (typeof window !== "undefined") clientId = id;
      return createElement("p", { id }, "probe");
    };
    const { renderSnapshot } = await import("./render-snapshot");
    const { hydrateRoot } = await import("react-dom/client");

    const html = renderSnapshot(createElement(Probe));
    const rootHtml = /<div id="root">([\s\S]*)<\/div><\/body>/.exec(html)![1];
    const root = document.getElementById("root")!;
    root.innerHTML = rootHtml;
    const serverId = root.querySelector("p")!.id;

    const errors: unknown[] = [];
    const { act } = await import("react");
    await act(async () => {
      hydrateRoot(root, createElement(Probe), { onRecoverableError: (error) => errors.push(error) });
    });

    expect(errors).toEqual([]);
    expect(clientId).toBe(serverId);
    expect(root.querySelector("p")!.id).toBe(serverId);
  });
});
