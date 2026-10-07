import { productSlugBase } from "../../shared/product-path.js";
import { uniqueSlug } from "./slugify.js";

export interface SluggableProduct {
  id: string;
  title: string;
  slug: string | null;
}

/**
 * Slugs for the products that have none yet, unique across all products. Existing
 * slugs are never changed: they are live URLs that Google and guests may hold.
 */
export function assignProductSlugs(products: SluggableProduct[]): { id: string; slug: string }[] {
  const taken = new Set(products.map((p) => p.slug).filter((s): s is string => Boolean(s)));
  const assigned: { id: string; slug: string }[] = [];
  for (const product of products) {
    if (product.slug) continue;
    const slug = uniqueSlug(productSlugBase(product.title), taken);
    taken.add(slug);
    assigned.push({ id: product.id, slug });
  }
  return assigned;
}
