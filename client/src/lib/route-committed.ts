import { useEffect } from "react";

let markCommitted: () => void = () => {};

/**
 * Resolves once the route's content has committed. React hydrates <Suspense> content
 * in a later pass than the root, so client/src/main.tsx waits for this (not for the
 * root) before switching a visitor to their language — switching earlier makes the
 * text differ from the English HTML still being hydrated.
 */
export const routeContentCommitted = new Promise<void>((resolve) => {
  markCommitted = resolve;
});

/** Renders nothing; place inside the route <Suspense>, after the routes. */
export function RouteCommitted() {
  useEffect(() => markCommitted(), []);
  return null;
}
