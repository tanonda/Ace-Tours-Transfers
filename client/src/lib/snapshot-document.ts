/**
 * The prerendered page: the live document (its <head> carries the SEO tags the app
 * set) with #root replaced by React's server-rendered markup, which is exactly what
 * hydrateRoot expects to find. Works on a copy; the live page is left untouched.
 */
export function snapshotDocumentHtml(doc: Document, rootHtml: string): string {
  const copy = doc.documentElement.cloneNode(true) as HTMLElement;
  const root = copy.querySelector("#root");
  if (!root) throw new Error("snapshot: no #root element");
  root.innerHTML = rootHtml;
  return `<!DOCTYPE html>${copy.outerHTML}`;
}
