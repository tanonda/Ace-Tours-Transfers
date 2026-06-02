import DOMPurify, { type WindowLike } from "dompurify";
// jsdom ships no bundled types and we intentionally don't add @types/jsdom;
// the DOMPurify factory only needs the .window object at runtime.
// @ts-ignore - no type declarations for 'jsdom'
import { JSDOM } from "jsdom";

const purify = DOMPurify(new JSDOM("").window as unknown as WindowLike);

const ALLOWED_TAGS = [
  "p","br","strong","em","u","s","h1","h2","h3","h4","ul","ol","li",
  "blockquote","a","img","figure","figcaption","hr","code","pre","span",
];
const ALLOWED_ATTR = ["href","src","alt","title","target","rel","class"];

/** Sanitize article HTML before persisting. Strips scripts, event handlers, js: URLs. */
export function sanitizeServerHtml(html: string): string {
  return purify.sanitize(html ?? "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
  });
}
