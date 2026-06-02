export interface SitemapEntry {
  loc: string;
  priority: string;
  changefreq: string;
  lastmod: string;
}

interface ArticleRow {
  slug: string;
  status: string;
  updatedAt: Date | null;
}

/** Sitemap entries for published articles: /blog/<slug>, priority 0.7. */
export function publishedArticleSitemapEntries(rows: ArticleRow[], now: string): SitemapEntry[] {
  return rows
    .filter((a) => a.status === "published")
    .map((a) => ({
      loc: `/blog/${a.slug}`,
      priority: "0.7",
      changefreq: "monthly",
      lastmod: a.updatedAt ? new Date(a.updatedAt).toISOString().split("T")[0] : now,
    }));
}
