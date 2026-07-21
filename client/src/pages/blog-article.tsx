import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { TourCard } from "@/components/tour-card";
import NotFound from "@/pages/not-found";
import { fetchArticle } from "@/lib/api-blog";
import { buildBlogPostingJsonLd } from "@/lib/blog-jsonld";
import { sanitizeHtml } from "@/components/shared-detail-components";
import { cleanProductList } from "@/lib/product-filters";
import { useLocalizedProducts } from "@/hooks/useLocalizedProducts";

const SITE_URL = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "") || "https://acetoursvanuatu.com";

export default function BlogArticle() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: article, isLoading, isError } = useQuery({
    queryKey: ["article", slug],
    queryFn: () => fetchArticle(slug),
    retry: false,
  });
  const productsQuery = useLocalizedProducts();

  if (isLoading) {
    return <Layout><div className="container mx-auto px-4 py-40 text-center text-muted-foreground">Loading…</div></Layout>;
  }
  if (isError || !article) return <NotFound />;

  const canonical = `${SITE_URL}/blog/${article.slug}`;
  const seoKeywords = article.seoKeywords
    ? article.seoKeywords.split(",").map((keyword) => keyword.trim()).filter(Boolean)
    : [];
  const related = cleanProductList(productsQuery.data ?? [])
    .filter((p) => (article.relatedProductIds ?? []).includes(p.id));
  const date = article.publishedAt
    ? new Date(article.publishedAt as unknown as string).toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <Layout>
      <SEO
        title={article.seoTitle || article.title}
        description={article.seoDescription || article.excerpt || article.title}
        image={article.coverImage || undefined}
        imageAlt={article.imageAlt || article.title}
        type="article"
        keywords={[...seoKeywords, ...(article.tags ?? [])]}
        extraJsonLd={buildBlogPostingJsonLd(article, canonical)}
      />
      <article className="bg-background">
        <header className="bg-muted/30 pt-40 pb-12">
          <div className="container mx-auto max-w-3xl px-4">
            {article.tags?.length ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {article.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t}</span>)}
              </div>
            ) : null}
            <h1 className="mb-4 font-serif text-4xl font-bold leading-tight md:text-5xl">{article.title}</h1>
            <p className="text-sm text-muted-foreground">{[article.author, date].filter(Boolean).join(" · ")}</p>
          </div>
        </header>

        {article.coverImage ? (
          <div className="container mx-auto max-w-4xl px-4 -mt-4">
            <img src={article.coverImage} alt={article.imageAlt || article.title} className="w-full rounded-2xl object-cover" />
          </div>
        ) : null}

        <div
          className="prose prose-lg mx-auto max-w-3xl px-4 py-12"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.bodyHtml) }}
        />

        {related.length > 0 ? (
          <div className="container mx-auto max-w-5xl px-4 py-8">
            <h2 className="mb-6 font-serif text-2xl font-bold">Book a related experience</h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {related.map((p, i) => <TourCard key={p.id} tour={{ ...p, category: p.category as any }} index={i} />)}
            </div>
          </div>
        ) : null}

        <div className="container mx-auto max-w-3xl px-4 py-10 text-center">
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/blog" className="rounded-lg border border-primary px-6 py-3 font-semibold text-primary">More guides</Link>
            <Link href="/tours" className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">Browse tours</Link>
            <Link href="/contact" className="rounded-lg border border-primary px-6 py-3 font-semibold text-primary">Contact us</Link>
          </div>
        </div>
      </article>
    </Layout>
  );
}
