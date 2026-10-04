// Test-only: a jsdom document plus a render helper, for provider tests that need
// effects and re-renders (vitest runs these files in the node environment).
// @ts-ignore - jsdom ships no type declarations
import { JSDOM } from "jsdom";
import type { ReactElement } from "react";

export function installDom(): void {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: "http://localhost/" });
  const globals: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    Node: dom.window.Node,
    HTMLElement: dom.window.HTMLElement,
    HTMLIFrameElement: dom.window.HTMLIFrameElement,
    localStorage: dom.window.localStorage,
    // wouter's browser location reads these bare globals.
    location: dom.window.location,
    history: dom.window.history,
    Event: dom.window.Event,
    addEventListener: dom.window.addEventListener.bind(dom.window),
    removeEventListener: dom.window.removeEventListener.bind(dom.window),
    dispatchEvent: dom.window.dispatchEvent.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
}

/** Renders `element` and flushes its effects; `act` flushes later updates. */
export async function mount(element: ReactElement) {
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, act, unmount: () => act(() => root.unmount()) };
}
