/** Product ids are UUIDs; anything else in a /tours/:x or /transfers/:x URL is a slug. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SLUG_LENGTH = 60;

export function isProductId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export interface ProductPathInput {
  id: string;
  slug?: string | null;
  category?: string | null;
}

/** The public URL path of a product's detail page. */
export function productPath(product: ProductPathInput): string {
  const section = product.category === "transfer" ? "transfers" : "tours";
  return `/${section}/${product.slug || product.id}`;
}

/**
 * The slug a product title would get, before de-duplication. Admin titles often add
 * " | subtitle" keyword tails, which would make very long URLs; only the main title is kept.
 */
export function productSlugBase(title: string): string {
  const main = (title ?? "").split(" | ")[0];
  let slug = main
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.slice(0, MAX_SLUG_LENGTH + 1);
    slug = slug.slice(0, slug.lastIndexOf("-") > 0 ? slug.lastIndexOf("-") : MAX_SLUG_LENGTH);
  }
  return slug || "product";
}
