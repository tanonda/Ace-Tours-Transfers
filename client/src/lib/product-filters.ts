/**
 * Shared product list cleanup used by the /tours listing and the SEO landing
 * pages. Drops inactive products and obvious test/seed data, then de-dupes by
 * normalized title (treating "X" and "X Package" as the same), preferring the
 * active entry. Extracted verbatim from the original inline logic in tours.tsx
 * so both call sites share one implementation.
 */
export function cleanProductList<T extends { title: string; isActive?: boolean }>(
  items: T[],
): T[] {
  const normalize = (t: string) => t.replace(/\s+Package$/i, '').trim();

  return items.reduce<T[]>((acc, current) => {
    if (current.isActive === false) return acc;

    const titleLower = current.title.toLowerCase();
    if (
      titleLower.includes('verification') ||
      titleLower.includes('concurrent') ||
      titleLower.includes('test_tour') ||
      titleLower.includes('phase4')
    ) {
      return acc;
    }

    const normalizedTitle = normalize(current.title);
    const existingIndex = acc.findIndex(
      (item) => normalize(item.title) === normalizedTitle,
    );

    if (existingIndex === -1) {
      acc.push(current);
    } else if (current.isActive !== false && acc[existingIndex].isActive === false) {
      acc[existingIndex] = current;
    }
    return acc;
  }, []);
}
