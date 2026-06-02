import type { Article } from "@shared/schema";

export async function fetchArticles(): Promise<Article[]> {
  const res = await fetch("/api/articles", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load articles");
  return res.json();
}

export async function fetchArticle(slug: string): Promise<Article> {
  const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`, { credentials: "include" });
  if (!res.ok) throw new Error("Article not found");
  return res.json();
}
