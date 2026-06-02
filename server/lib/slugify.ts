/** Turn a title into a URL-safe slug. Falls back to "article" if nothing usable. */
export function slugify(input: string): string {
  const s = (input ?? "")
    .normalize("NFKD")               // split accents from letters
    .replace(/[̀-ͯ]/g, "") // strip diacritics (combining marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")     // non-alphanumerics → hyphen
    .replace(/^-+|-+$/g, "")         // trim leading/trailing hyphens
    .replace(/-{2,}/g, "-");         // collapse repeats
  return s || "article";
}

/** Ensure a slug is unique against a set of taken slugs, suffixing -2, -3, ... */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
