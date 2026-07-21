import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Clock3, Compass, MapPin, Palmtree } from "lucide-react";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { TourCard } from "@/components/tour-card";
import NotFound from "@/pages/not-found";
import { fetchArticle } from "@/lib/api-blog";
import { buildBlogPostingJsonLd } from "@/lib/blog-jsonld";
import { sanitizeHtml } from "@/components/shared-detail-components";
import { cleanProductList } from "@/lib/product-filters";
import { useLocalizedProducts } from "@/hooks/useLocalizedProducts";
import { getGuideVisual, guideReadTime } from "@/lib/guide-visuals";

const SITE_URL = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "") || "https://acetoursvanuatu.com";

interface OutlineItem {
  id: string;
  label: string;
}

function headingId(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `section-${index + 1}`;
}

function prepareArticleHtml(rawHtml: string): { html: string; outline: OutlineItem[] } {
  const clean = sanitizeHtml(rawHtml);
  const outline: OutlineItem[] = [];
  const used = new Set<string>();
  const html = clean.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_match, attributes, contents) => {
    const label = String(contents).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
    let id = headingId(label, outline.length);
    let suffix = 2;
    while (used.has(id)) id = `${headingId(label, outline.length)}-${suffix++}`;
    used.add(id);
    outline.push({ id, label });
    return `<h2${attributes} id="${id}">${contents}</h2>`;
  });
  return { html, outline };
}

function GuideOutline({ items, mobile = false }: { items: OutlineItem[]; mobile?: boolean }) {
  const links = (
    <ol className="space-y-1.5">
      {items.map((item, index) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="group flex min-h-11 items-start gap-3 rounded-xl px-3 py-2.5 text-sm leading-5 text-[#665848] transition hover:bg-[#e9dfcd] hover:text-[#24180f] dark:text-[#c8bba9] dark:hover:bg-white/5 dark:hover:text-white"
          >
            <span className="mt-0.5 font-mono text-[0.68rem] font-bold text-[#b86412] dark:text-[#ffb552]">{String(index + 1).padStart(2, "0")}</span>
            <span>{item.label}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  if (mobile) {
    return (
      <details className="group rounded-2xl border border-[#d8cbb6] bg-white/60 p-2 dark:border-white/10 dark:bg-white/5 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 font-bold text-[#2b1d13] dark:text-white">
          <span className="inline-flex items-center gap-2"><Compass className="h-4 w-4 text-[#b86412]" aria-hidden="true" /> In this guide</span>
          <span className="text-[#b86412] transition group-open:rotate-45" aria-hidden="true">+</span>
        </summary>
        <nav aria-label="Article sections" className="border-t border-[#d8cbb6] pt-2 dark:border-white/10">{links}</nav>
      </details>
    );
  }

  return (
    <nav aria-label="Article sections">
      <p className="mb-3 flex items-center gap-2 px-3 text-xs font-bold uppercase tracking-[0.18em] text-[#b86412] dark:text-[#ffb552]">
        <Compass className="h-4 w-4" aria-hidden="true" /> In this guide
      </p>
      {links}
    </nav>
  );
}

export default function BlogArticle() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: article, isLoading, isError } = useQuery({
    queryKey: ["article", slug],
    queryFn: () => fetchArticle(slug),
    retry: false,
  });
  const productsQuery = useLocalizedProducts();
  const prepared = useMemo(() => prepareArticleHtml(article?.bodyHtml ?? ""), [article?.bodyHtml]);

  if (isLoading) {
    return (
      <Layout>
        <main className="min-h-screen bg-[#f7f3e9] px-4 pt-40 dark:bg-[#160f0a]" aria-live="polite">
          <div className="container mx-auto max-w-5xl animate-pulse">
            <div className="h-[55vh] min-h-[28rem] rounded-3xl bg-[#e3d9c7] dark:bg-white/10" />
          </div>
          <span className="sr-only">Loading travel guide…</span>
        </main>
      </Layout>
    );
  }
  if (isError || !article) return <NotFound />;

  const visual = getGuideVisual(article);
  const visualUrl = visual.image.startsWith("http") ? visual.image : `${SITE_URL}${visual.image}`;
  const canonical = `${SITE_URL}/blog/${article.slug}`;
  const seoKeywords = article.seoKeywords
    ? article.seoKeywords.split(",").map((keyword) => keyword.trim()).filter(Boolean)
    : [];
  const related = cleanProductList(productsQuery.data ?? [])
    .filter((product) => (article.relatedProductIds ?? []).includes(product.id));
  const date = article.publishedAt
    ? new Date(article.publishedAt as unknown as string).toLocaleDateString("en-AU", { year: "numeric", month: "long", day: "numeric" })
    : "";
  const readTime = guideReadTime(article.bodyHtml);
  const structuredArticle = { ...article, coverImage: visualUrl };

  return (
    <Layout>
      <SEO
        title={article.seoTitle || article.title}
        description={article.seoDescription || article.excerpt || article.title}
        image={visualUrl}
        imageAlt={article.imageAlt || article.title}
        type="article"
        keywords={[...seoKeywords, ...(article.tags ?? [])]}
        extraJsonLd={buildBlogPostingJsonLd(structuredArticle, canonical)}
      />

      <main className="overflow-hidden bg-[#f7f3e9] text-[#281c13] dark:bg-[#160f0a] dark:text-[#f7f0df]">
        <article>
          <header className="relative isolate flex min-h-[42rem] items-end overflow-hidden pt-36 sm:min-h-[48rem] lg:min-h-[52rem]">
            <img
              src={visual.image}
              alt={article.imageAlt || article.title}
              className="absolute inset-0 -z-20 h-full w-full object-cover"
              style={{ objectPosition: visual.imagePosition }}
              fetchPriority="high"
              sizes="100vw"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#100b07]/35 via-[#100b07]/20 to-[#100b07]/95" />
            <div className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-[radial-gradient(ellipse_at_30%_100%,rgba(205,104,19,0.2),transparent_55%)]" />

            <div className="container mx-auto px-4 pb-10 text-white sm:px-6 sm:pb-14 lg:px-8 lg:pb-16">
              <Link href="/blog" className="mb-7 hidden min-h-11 items-center gap-2 rounded-full border border-white/25 bg-black/20 px-4 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white hover:text-[#271a11] sm:inline-flex">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All travel guides
              </Link>

              <div className="max-w-5xl">
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#ffc36f] sm:text-sm">{visual.kicker}</p>
                <h1 className="max-w-[19ch] text-balance font-serif text-[clamp(2.75rem,7vw,6.5rem)] font-bold leading-[0.94] tracking-[-0.035em] text-white">{article.title}</h1>
                {article.excerpt ? <p className="mt-6 max-w-[62ch] text-base leading-7 text-white/78 sm:text-xl sm:leading-8">{article.excerpt}</p> : null}

                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/20 pt-5 text-sm text-white/75">
                  <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#ffb552]" aria-hidden="true" /> {visual.location}</span>
                  <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#ffb552]" aria-hidden="true" /> {readTime} min read</span>
                  <span>{[article.author, date].filter(Boolean).join(" · ")}</span>
                </div>
              </div>
            </div>
          </header>

          <div className="container mx-auto px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
            <Link href="/blog" className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d8cbb6] bg-white/60 px-4 text-sm font-bold text-[#2b1d13] dark:border-white/10 dark:bg-white/5 dark:text-white sm:hidden">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All travel guides
            </Link>
            {prepared.outline.length > 0 ? <GuideOutline items={prepared.outline} mobile /> : null}

            <div className="mt-8 grid items-start gap-10 lg:mt-0 lg:grid-cols-[15rem_minmax(0,68ch)] lg:justify-center lg:gap-14 xl:grid-cols-[16rem_minmax(0,68ch)] xl:gap-20">
              <aside className="sticky top-32 hidden max-h-[calc(100vh-10rem)] overflow-y-auto border-r border-[#d8cbb6] pr-5 dark:border-white/10 lg:block">
                {prepared.outline.length > 0 ? <GuideOutline items={prepared.outline} /> : null}
              </aside>

              <div>
                <div className="mb-10 flex flex-wrap gap-2" aria-label="Article topics">
                  {article.tags?.map((tag) => (
                    <span key={tag} className="rounded-full border border-[#d3c4ad] bg-white/55 px-3 py-1.5 text-xs font-bold text-[#6c5947] dark:border-white/10 dark:bg-white/5 dark:text-[#d3c5b2]">{tag}</span>
                  ))}
                </div>

                <div className="travel-prose" dangerouslySetInnerHTML={{ __html: prepared.html }} />

                <div className="mt-14 overflow-hidden rounded-3xl bg-[#233c38] p-6 text-white shadow-[0_20px_70px_rgba(30,46,42,0.2)] sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ffad3d] text-[#25180f]"><Palmtree className="h-5 w-5" aria-hidden="true" /></div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ffc36f]">A local route, shaped around you</p>
                      <h2 className="mt-2 font-serif text-2xl font-bold leading-tight text-white sm:text-3xl">Want help turning this guide into your day?</h2>
                      <p className="mt-3 max-w-[55ch] leading-7 text-white/72">Tell us where you are staying, who you are travelling with, and what you do not want to rush.</p>
                      <Link href="/contact" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ffad3d] px-5 font-bold text-[#25180f] transition hover:bg-[#ffc978]">
                        Plan with Ace Tours <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {related.length > 0 ? (
            <section className="border-y border-[#d8cbb6] bg-[#eee4d2] py-14 dark:border-white/10 dark:bg-[#1d140e] sm:py-20" aria-labelledby="related-experiences-title">
              <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b86412] dark:text-[#ffb552]">Continue the journey</p>
                <h2 id="related-experiences-title" className="mt-2 mb-8 font-serif text-3xl font-bold sm:text-4xl">Book a related experience</h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {related.map((product, index) => <TourCard key={product.id} tour={{ ...product, category: product.category as any }} index={index} />)}
                </div>
              </div>
            </section>
          ) : null}

          <footer className="bg-[#21160e] py-12 text-white sm:py-16">
            <div className="container mx-auto flex max-w-5xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ffb552]">Keep exploring</p>
                <p className="mt-2 max-w-[32ch] font-serif text-3xl font-bold leading-tight">More local knowledge, fewer rushed island days.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/blog" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 px-5 font-bold text-white transition hover:bg-white hover:text-[#21160e]">More guides</Link>
                <Link href="/tours" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ffad3d] px-5 font-bold text-[#21160e] transition hover:bg-[#ffc978]">Browse tours</Link>
              </div>
            </div>
          </footer>
        </article>
      </main>
    </Layout>
  );
}
