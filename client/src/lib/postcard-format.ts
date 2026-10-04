/** Shorten a product duration for the round badge on transfer cards ("5-8 hours" → "5–8 HRS"). */
export function shortDuration(duration: string | null | undefined): string | null {
  const text = String(duration ?? "").trim();
  if (!text) return null;
  const short = text
    .replace(/(\d)\s*-\s*(\d)/g, "$1–$2")
    .replace(/\bmin(ute)?s?\b/gi, "MIN")
    .replace(/\bhours\b|\bhrs\b/gi, "HRS")
    .replace(/\bhour\b/gi, "HOUR")
    .toUpperCase();
  // The badge stacks one word per line in a 64px circle: at most 8 characters in all,
  // and no line longer than 5.
  return short.length <= 8 && short.split(" ").every((word) => word.length <= 5) ? short : null;
}

/** "VT 9,600" → ["VT", "9,600"] so the stamp can stack them; "A$124.80" stays on one line. */
export function splitPriceForStamp(formatted: string): string[] {
  const match = /\s/.exec(formatted); // includes the formatter's non-breaking space
  return match && match.index > 0
    ? [formatted.slice(0, match.index), formatted.slice(match.index + 1)]
    : [formatted];
}
