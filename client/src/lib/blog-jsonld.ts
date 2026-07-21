export interface ArticleLike {
  title: string;
  excerpt?: string | null;
  coverImage?: string | null;
  imageAlt?: string | null;
  author?: string | null;
  tags?: string[] | null;
  publishedAt?: string | Date | null;
  updatedAt?: string | Date | null;
  seoDescription?: string | null;
}

/** Build schema.org BlogPosting JSON-LD for an article page. */
export function buildBlogPostingJsonLd(a: ArticleLike, canonicalUrl: string): Record<string, unknown> {
  const siteUrl = new URL(canonicalUrl).origin;
  const isCompanyAuthor = a.author === "Ace Tours & Transfers Vanuatu";
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.seoDescription || a.excerpt || a.title,
    url: canonicalUrl,
    inLanguage: "en",
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
    publisher: {
      "@type": "Organization",
      name: "Ace Tours & Transfers Vanuatu",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/assets/logo.png` },
    },
  };
  if (a.coverImage) ld.image = a.coverImage;
  if (a.publishedAt) ld.datePublished = a.publishedAt;
  if (a.updatedAt) ld.dateModified = a.updatedAt;
  if (a.author) ld.author = { "@type": isCompanyAuthor ? "Organization" : "Person", name: a.author };
  if (a.tags && a.tags.length) ld.keywords = a.tags.join(", ");
  return ld;
}
