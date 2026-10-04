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
  // DOM classes and helpers UI libraries (Radix) use as bare globals.
  for (const key of ["DocumentFragment", "Element", "SVGElement", "Text", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "KeyboardEvent", "MouseEvent", "PointerEvent", "CustomEvent", "PopStateEvent", "DOMRect"]) {
    if (key in dom.window) globals[key] = typeof dom.window[key] === "function" && /^[a-z]/.test(key) ? dom.window[key].bind(dom.window) : dom.window[key];
  }
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

/**
 * Counts re-renders per component name via the React DevTools hook (the same way the
 * DevTools profiler does). Call before react-dom is first imported in the test file.
 */
export function recordRenders(): Map<string, number> {
  const counts = new Map<string, number>();
  const isComponent = (f: any) => [0, 1, 11, 14, 15].includes(f.tag);
  const nameOf = (f: any) => f.type?.displayName || f.type?.name || f.type?.type?.name || f.type?.render?.name;
  const walk = (f: any) => {
    for (; f; f = f.sibling) {
      const prev = f.alternate;
      if (!prev) continue; // a mount, not a re-render
      if (isComponent(f) && (f.flags & 1) === 1) {
        const name = nameOf(f);
        if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      if (f.child !== prev.child || (f.flags & 1) === 1) walk(f.child);
    }
  };
  (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject(renderer: unknown) { this.renderers.set(this.renderers.size + 1, renderer); return this.renderers.size; },
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
    onCommitFiberRoot(_id: number, root: any) { walk(root.current.child); },
  };
  return counts;
}
