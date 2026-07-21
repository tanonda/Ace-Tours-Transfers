import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { ArticleCard } from "@/components/blog/article-card";
import { fetchArticles } from "@/lib/api-blog";
import { FEATURED_GUIDE_SLUG } from "@/lib/guide-visuals";
import { Compass, MapPin, Palmtree } from "lucide-react";

export default function Blog() {
  const { data: articles = [], isLoading } = useQuery({ queryKey: ["articles"], queryFn: fetchArticles });
  const featured = articles.find((article) => article.slug === FEATURED_GUIDE_SLUG) ?? articles[0];
  const remaining = articles.filter((article) => article.id !== featured?.id);

  return (
    <Layout>
      <SEO
        title="Vanuatu Travel Blog & Guides"
        description="Travel tips, things to do, and local guides for Port Vila and Efate Island, Vanuatu — from the Ace Tours & Transfers team."
        keywords={["Vanuatu travel guide", "things to do Port Vila", "Vanuatu travel tips", "Efate Island guide"]}
      />
      <main className="overflow-hidden bg-[#f7f3e9] text-[#251a11] dark:bg-[#160f0a] dark:text-[#f7f0df]">
        <section className="relative isolate min-h-[36rem] overflow-hidden pt-36 sm:min-h-[42rem] sm:pt-44" aria-labelledby="travel-guides-title">
          <img
            src="/assets/guides/vanuatu-coast-field-guide.webp"
            alt="Aerial view of a tropical Vanuatu coastline and coral lagoon"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
            fetchPriority="high"
            sizes="100vw"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#120c08]/35 via-[#120c08]/35 to-[#120c08]/90" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_35%,rgba(255,178,70,0.13),transparent_26%)]" />

          <div className="container mx-auto flex min-h-[27rem] flex-col justify-end px-4 pb-12 sm:min-h-[32rem] sm:px-6 sm:pb-16 lg:px-8">
            <div className="max-w-4xl text-white">
              <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#ffc36f] sm:text-sm">
                <Compass className="h-4 w-4" aria-hidden="true" /> Local field notes · Vanuatu
              </p>
              <h1 id="travel-guides-title" className="max-w-[15ch] text-balance font-serif text-[clamp(3rem,8vw,7rem)] font-bold leading-[0.92] tracking-[-0.035em] text-white">
                Follow the island, not the itinerary.
              </h1>
              <p className="mt-6 max-w-[58ch] text-base leading-7 text-white/80 sm:text-xl sm:leading-8">
                Practical guides, local context, and unhurried routes for seeing Port Vila, Efate, and the islands beyond.
              </p>
            </div>

            <div className="mt-10 grid max-w-3xl grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-white/75 sm:gap-4 sm:text-xs" aria-label="Guide coverage: Port Vila, Efate and outer islands">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#ffad3d]" aria-hidden="true" /> Port Vila</span>
              <span className="h-px bg-gradient-to-r from-[#ffad3d] to-white/25" aria-hidden="true" />
              <span>Efate</span>
              <span className="h-px bg-gradient-to-r from-white/25 to-[#62cfc4]" aria-hidden="true" />
              <span className="inline-flex items-center gap-1.5"><Palmtree className="h-3.5 w-3.5 text-[#62cfc4]" aria-hidden="true" /> Islands</span>
            </div>
          </div>
        </section>

        <section className="relative py-14 sm:py-20 lg:py-24" aria-label="Vanuatu travel guides">
          <div className="pointer-events-none absolute right-[-8rem] top-12 h-72 w-72 rounded-full border border-[#2d8f88]/10" aria-hidden="true" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col gap-4 sm:mb-14 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b86412] dark:text-[#ffb552]">Start exploring</p>
                <h2 className="mt-3 max-w-[18ch] text-balance font-serif text-[clamp(2.25rem,5vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.025em]">Guides made for real island days</h2>
              </div>
              <p className="max-w-[48ch] text-base leading-7 text-[#665848] dark:text-[#c8bba9] sm:text-right">
                Built around swimming time, road distances, local customs, and enough breathing room to enjoy where you are.
              </p>
            </div>

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading travel guides" aria-live="polite">
              {[0, 1, 2].map((item) => <div key={item} className="h-[30rem] animate-pulse rounded-[1.4rem] bg-[#e8dfcf] dark:bg-white/10" />)}
            </div>
          ) : articles.length === 0 ? (
            <div className="rounded-3xl border border-[#d7cbb9] bg-white/55 px-6 py-16 text-center dark:border-white/10 dark:bg-white/5">
              <Palmtree className="mx-auto h-8 w-8 text-[#b86412]" aria-hidden="true" />
              <p className="mt-4 text-[#665848] dark:text-[#c8bba9]">New island guides are being prepared. Check back shortly.</p>
            </div>
          ) : (
            <div className="space-y-6 sm:space-y-8">
              {featured ? <ArticleCard article={featured} featured /> : null}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8">
                {remaining.map((article) => <ArticleCard key={article.id} article={article} />)}
              </div>
            </div>
          )}
          </div>
        </section>

        <section className="border-t border-[#d8cbb6] bg-[#efe6d5] py-14 dark:border-white/10 dark:bg-[#1d140e] sm:py-16">
          <div className="container mx-auto grid gap-6 px-4 sm:px-6 md:grid-cols-[1fr_auto] md:items-center lg:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b86412] dark:text-[#ffb552]">Local help, when you need it</p>
              <h2 className="mt-2 max-w-[25ch] text-balance font-serif text-3xl font-bold leading-tight sm:text-4xl">Turn a saved guide into a day worth remembering.</h2>
            </div>
            <Link href="/contact" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#2a1d13] px-6 font-bold text-white transition hover:bg-[#b86412] dark:bg-[#f2992e] dark:text-[#21160d] dark:hover:bg-[#ffc36f]">
              Plan with our local team
            </Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}
