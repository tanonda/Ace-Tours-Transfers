import type { Article } from "@shared/schema";

export async function fetchArticles(): Promise<Article[]> {
  const res = await fetch("/api/articles", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load articles");
  return res.json();
}

export async function fetchArticle(slug: string): Promise<Article> {
  const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`, { credentials: "include" });
  // The status lets the page tell "no such article" (404) from "couldn't load it".
  if (!res.ok) throw Object.assign(new Error(`Article request failed: ${res.status}`), { status: res.status });
  return res.json();
}
