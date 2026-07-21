import { Link } from "wouter";
import { ArrowUpRight, Clock3, MapPin } from "lucide-react";
import type { Article } from "@shared/schema";
import { getGuideVisual, guideReadTime } from "@/lib/guide-visuals";

export function ArticleCard({ article, featured = false }: { article: Article; featured?: boolean }) {
  const date = article.publishedAt
    ? new Date(article.publishedAt as unknown as string).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" })
    : "";
  const visual = getGuideVisual(article);
  const readTime = guideReadTime(article.bodyHtml);

  return (
    <Link
      href={`/blog/${article.slug}`}
      aria-label={`Read ${article.title}`}
      className={`group grid min-h-full overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#21180f] text-white shadow-[0_18px_60px_rgba(39,25,12,0.12)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(39,25,12,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59a23] focus-visible:ring-offset-4 ${
        featured ? "md:grid-cols-[1.25fr_0.75fr]" : "grid-rows-[auto_1fr]"
      }`}
    >
      <div className={`relative overflow-hidden ${featured ? "min-h-[18rem] md:min-h-[28rem]" : "aspect-[4/3] sm:aspect-[16/11]"}`}>
        <img
          src={visual.image}
          alt={article.imageAlt || article.title}
          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.035]"
          style={{ objectPosition: visual.imagePosition }}
          loading={featured ? "eager" : "lazy"}
          fetchPriority={featured ? "high" : "auto"}
          sizes={featured ? "(min-width: 768px) 62vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#160f09]/70 via-transparent to-transparent md:bg-gradient-to-r" />
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/25 bg-black/35 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-md sm:left-5 sm:top-5">
          <MapPin className="h-3.5 w-3.5 text-[#ffab38]" aria-hidden="true" />
          {visual.location}
        </div>
      </div>

      <div className={`relative flex flex-col ${featured ? "justify-center p-6 sm:p-8 lg:p-10" : "p-5 sm:p-6"}`}>
        <div className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#ffb552]">
          <span>{visual.kicker}</span>
          <span className="h-px w-7 bg-[#ffb552]/50" aria-hidden="true" />
          <span className="inline-flex items-center gap-1.5 text-white/65 normal-case tracking-normal">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" /> {readTime} min read
          </span>
        </div>
        <h2 className={`${featured ? "text-[clamp(2rem,4vw,3.5rem)]" : "text-2xl sm:text-[1.7rem]"} text-balance font-serif font-bold leading-[1.08] text-white transition-colors group-hover:text-[#ffc878]`}>
          {article.title}
        </h2>
        {article.excerpt ? (
          <p className={`mt-4 max-w-[58ch] leading-7 text-white/70 ${featured ? "text-base sm:text-lg" : "line-clamp-3 text-[0.95rem]"}`}>
            {article.excerpt}
          </p>
        ) : null}
        <div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-4">
          <p className="text-xs text-white/55">{date}</p>
          <span className="inline-flex min-h-11 items-center gap-2 font-bold text-[#ffb552]">
            Read guide <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
