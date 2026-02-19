/**
 * Escapes HTML special characters to prevent XSS / HTML injection
 * in email templates and other HTML contexts.
 *
 * SECURITY (CRIT-1, CRIT-2): All user-supplied strings MUST be passed
 * through this function before interpolation into HTML templates.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
