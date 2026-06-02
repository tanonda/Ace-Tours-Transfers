import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { ArticleCard } from "@/components/blog/article-card";
import { fetchArticles } from "@/lib/api-blog";

export default function Blog() {
  const { data: articles = [], isLoading } = useQuery({ queryKey: ["articles"], queryFn: fetchArticles });

  return (
    <Layout>
      <SEO
        title="Vanuatu Travel Blog & Guides"
        description="Travel tips, things to do, and local guides for Port Vila and Efate Island, Vanuatu — from the Ace Tours & Transfers team."
        keywords={["Vanuatu travel guide", "things to do Port Vila", "Vanuatu travel tips", "Efate Island guide"]}
      />
      <div className="bg-muted/30 pt-40 pb-20">
        <div className="container mx-auto px-4">
          <h1 className="mb-4 text-center font-serif text-5xl font-bold">Vanuatu Travel Guides</h1>
          <p className="mx-auto mb-12 max-w-2xl text-center text-lg text-muted-foreground">
            Tips, itineraries, and local knowledge to help you make the most of Port Vila and Efate Island.
          </p>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : articles.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">New guides are coming soon — check back shortly.</div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => <ArticleCard key={a.id} article={a} />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
