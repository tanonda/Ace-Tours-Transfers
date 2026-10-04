import { createElement, lazy, useState, type ComponentProps, type ComponentType } from "react";

export type PreloadableComponent<T extends ComponentType<any>> = T & { preload: () => Promise<void> };

/**
 * React.lazy that can be loaded ahead of rendering. Once preloaded it renders
 * synchronously, so hydrating a prerendered page never has to wait for the page's
 * chunk (a boundary left waiting gets client-rendered as soon as any context above
 * it updates — see client/src/main.tsx).
 */
export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): PreloadableComponent<T> {
  let loaded: T | undefined;
  let pending: Promise<void> | undefined;
  const load = () =>
    (pending ??= factory().then((module) => {
      loaded = module.default;
    }));
  const Lazy = lazy(() => load().then(() => ({ default: loaded! })));

  function Preloadable(props: ComponentProps<T>) {
    // Keep whichever type this instance mounted with: switching from Lazy to the
    // loaded component later would remount the page.
    const [Component] = useState<ComponentType<any>>(() => loaded ?? Lazy);
    return createElement(Component, props);
  }
  Preloadable.preload = load;
  return Preloadable as unknown as PreloadableComponent<T>;
}

/** wouter-style patterns: literal segments and ":param" segments, optional trailing slash. */
export function matchesRoutePattern(pattern: string, path: string): boolean {
  const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  const want = trim(pattern).split("/");
  const got = trim(path).split("/");
  return want.length === got.length && want.every((segment, i) => (segment.startsWith(":") ? got[i] !== "" : segment === got[i]));
}
