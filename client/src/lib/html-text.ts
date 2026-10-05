/**
 * Turn stored HTML (product descriptions, CMS rich text) into display text:
 * tags removed, block boundaries kept as spaces, entities decoded. Pure string
 * work so it behaves the same in the prerender, the browser and tests.
 */
const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED[code.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  const withoutTags = html
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|li|p|ul|ol)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

/** True for editor leftovers like "<p></p>" or "<p><br></p>" that hold no text. */
export function isBlankHtml(html: string | null | undefined): boolean {
  return htmlToText(html) === "";
}
