const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * Escapes a value for an HTML string (text or a quoted attribute). Use for every
 * booking field interpolated into a print window built with document.write: those
 * windows run in the site's origin, so unescaped guest input there is stored XSS.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);
}
