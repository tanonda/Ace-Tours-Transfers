export interface ArticleLike {
  title: string;
  excerpt?: string | null;
  coverImage?: string | null;
  imageAlt?: string | null;
  author?: string | null;
  tags?: string[] | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  seoDescription?: string | null;
}

/** Build schema.org BlogPosting JSON-LD for an article page. */
export function buildBlogPostingJsonLd(a: ArticleLike, canonicalUrl: string): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.seoDescription || a.excerpt || a.title,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    publisher: { "@type": "Organization", name: "Ace Tours & Transfers Vanuatu" },
  };
  if (a.coverImage) ld.image = a.coverImage;
  if (a.publishedAt) ld.datePublished = a.publishedAt;
  if (a.updatedAt) ld.dateModified = a.updatedAt;
  if (a.author) ld.author = { "@type": "Person", name: a.author };
  if (a.tags && a.tags.length) ld.keywords = a.tags.join(", ");
  return ld;
}
