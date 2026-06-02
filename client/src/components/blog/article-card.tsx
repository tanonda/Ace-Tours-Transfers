import { Link } from "wouter";
import type { Article } from "@shared/schema";

export function ArticleCard({ article }: { article: Article }) {
  const date = article.publishedAt
    ? new Date(article.publishedAt as unknown as string).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" })
    : "";
  return (
    <Link href={`/blog/${article.slug}`} className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md">
      {article.coverImage ? (
        <img src={article.coverImage} alt={article.imageAlt || article.title} className="h-48 w-full object-cover" loading="lazy" />
      ) : null}
      <div className="p-5">
        {article.tags?.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {article.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t}</span>
            ))}
          </div>
        ) : null}
        <h2 className="mb-2 font-serif text-xl font-bold group-hover:text-primary">{article.title}</h2>
        {article.excerpt ? <p className="mb-3 text-sm text-muted-foreground line-clamp-3">{article.excerpt}</p> : null}
        <p className="text-xs text-muted-foreground">{[article.author, date].filter(Boolean).join(" · ")}</p>
      </div>
    </Link>
  );
}
