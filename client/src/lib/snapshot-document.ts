/**
 * The prerendered page: the live document (its <head> carries the SEO tags the app
 * set) with #root replaced by React's server-rendered markup, which is exactly what
 * hydrateRoot expects to find, minus the preloads the app added at runtime. Works on
 * a copy; the live page is left untouched.
 */
export function snapshotDocumentHtml(doc: Document, rootHtml: string): string {
  const copy = doc.documentElement.cloneNode(true) as HTMLElement;
  // Preloads Vite added at runtime (marked as="script") are every chunk the prerender
  // tab happened to load — other routes, this renderer. Visitors would download them
  // all; the page's own chunk is fetched on boot anyway (preloadPrerenderedPage).
  copy.querySelectorAll('link[rel="modulepreload"][as="script"]').forEach((link) => link.remove());
  const root = copy.querySelector("#root");
  if (!root) throw new Error("snapshot: no #root element");
  root.innerHTML = rootHtml;
  return `<!DOCTYPE html>${copy.outerHTML}`;
}
