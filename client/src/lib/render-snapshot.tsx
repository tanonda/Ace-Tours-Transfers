import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { snapshotDocumentHtml } from "./snapshot-document";

/**
 * Loaded only by the prerender (scripts/prerender.ts via window.__ACE_RENDER_SNAPSHOT__).
 * Renders the current route with React's server renderer, using the data the live app
 * already loaded, so the snapshot is exactly what hydrateRoot will expect: Suspense
 * markers, text separators, useId values and first-render state all match.
 */
export function renderSnapshot(app: ReactElement): string {
  // In a browser, react-helmet-async registers every <Helmet> in a global list that
  // only unmount clears. This render never unmounts, so keep its instances in the
  // render's own context instead of leaking into later routes' <head>.
  const canUseDOM = HelmetProvider.canUseDOM;
  HelmetProvider.canUseDOM = false;
  let rootHtml: string;
  try {
    rootHtml = renderToString(app);
  } finally {
    HelmetProvider.canUseDOM = canUseDOM;
  }
  return snapshotDocumentHtml(document, rootHtml);
}
