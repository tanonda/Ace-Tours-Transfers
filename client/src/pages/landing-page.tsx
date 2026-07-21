import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { TourCard } from "@/components/tour-card";
import NotFound from "@/pages/not-found";
import { findLandingPage } from "@/lib/landing-pages";
import { cleanProductList } from "@/lib/product-filters";
import { useLocalizedTours, useLocalizedTransfers } from "@/hooks/useLocalizedProducts";

const RELATED_GUIDES: Record<string, Array<{ href: string; label: string }>> = {
  "port-vila-airport-transfers": [
    { href: "/blog/port-vila-airport-transfer-guide", label: "Port Vila airport transfer guide" },
    { href: "/blog/efate-vanuatu-3-day-itinerary", label: "A relaxed three-day Efate itinerary" },
  ],
  "efate-island-day-tours": [
    { href: "/blog/best-things-to-do-in-vanuatu", label: "18 best things to do in Vanuatu" },
    { href: "/blog/things-to-do-in-port-vila-vanuatu", label: "12 best things to do in Port Vila" },
    { href: "/blog/efate-vanuatu-3-day-itinerary", label: "A relaxed three-day Efate itinerary" },
  ],
  "blue-lagoon-vanuatu-tour": [
    { href: "/blog/blue-lagoon-vanuatu-tour-tips", label: "Blue Lagoon timing, swimming, and packing tips" },
    { href: "/blog/things-to-do-in-port-vila-vanuatu", label: "Things to do in Port Vila and nearby Efate" },
  ],
  "mele-cascades-tour": [
    { href: "/blog/things-to-do-in-port-vila-vanuatu", label: "Things to do in Port Vila and nearby Efate" },
    { href: "/blog/efate-vanuatu-3-day-itinerary", label: "A relaxed three-day Efate itinerary" },
  ],
  "vanuatu-cultural-tours": [
    { href: "/blog/best-things-to-do-in-vanuatu", label: "Vanuatu attractions by island" },
    { href: "/blog/vanuatu-attractions-which-island-to-visit", label: "How to choose between Efate, Tanna, and Santo" },
  ],
  "port-vila-private-transfers": [
    { href: "/blog/port-vila-cruise-transfer-and-shore-tour-guide", label: "Port Vila cruise and shore-day guide" },
    { href: "/blog/things-to-do-in-port-vila-vanuatu", label: "12 best things to do in Port Vila" },
  ],
};

export default function LandingPage() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const slug = location.replace(/^\/+/, "").replace(/\/+$/, "").split("?")[0];
  const config = findLandingPage(slug);

  // Always call hooks before any early return (Rules of Hooks).
  const toursQuery = useLocalizedTours();
  const transfersQuery = useLocalizedTransfers();

  if (!config) return <NotFound />;

  const query = config.category === "tour" ? toursQuery : transfersQuery;
  const all = query.data ?? [];
  const featured = cleanProductList(all).filter((p) =>
    config.featuredMatch.test(p.title),
  );
  const relatedGuides = RELATED_GUIDES[config.slug] ?? [];

  return (
    <Layout>
      <SEO
        title={config.seoTitle}
        description={config.seoDescription}
        keywords={config.keywords}
        faqs={config.faqs}
      />

      {/* Hero */}
      <section
        className="relative bg-cover bg-center pt-40 pb-20"
        style={{ backgroundImage: `linear-gradient(rgba(15,13,9,0.55),rgba(15,13,9,0.55)), url(${config.heroImage})` }}
      >
        <div className="container mx-auto px-4 text-center text-white">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">{config.h1}</h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto opacity-90">{config.subhead}</p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Intro */}
        {config.intro.map((para, i) => (
          <p key={i} className="text-lg text-muted-foreground mb-6 leading-relaxed">{para}</p>
        ))}

        {/* Featured products */}
        {query.isLoading ? (
          <div className="text-center py-12 text-muted-foreground">{t("common.loading")}</div>
        ) : featured.length > 0 ? (
          <div className="my-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featured.map((product, index) => (
                <TourCard
                  key={product.id}
                  tour={{ ...product, category: product.category as any }}
                  index={index}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Body sections */}
        {config.sections.map((section, i) => (
          <section key={i} className="my-10">
            <h2 className="text-2xl font-serif font-bold mb-4">{section.heading}</h2>
            {section.paragraphs.map((p, j) => (
              <p key={j} className="text-muted-foreground mb-4 leading-relaxed">{p}</p>
            ))}
          </section>
        ))}

        {relatedGuides.length > 0 ? (
          <section className="my-12 rounded-2xl border bg-card p-6">
            <h2 className="mb-4 text-2xl font-serif font-bold">Plan your Vanuatu visit</h2>
            <ul className="space-y-3">
              {relatedGuides.map((guide) => (
                <li key={guide.href}>
                  <Link href={guide.href} className="font-semibold text-primary hover:underline">
                    {guide.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* FAQ */}
        <section className="my-12">
          <h2 className="text-2xl font-serif font-bold mb-6">{t("landingPage.faq")}</h2>
          <div className="space-y-4">
            {config.faqs.map((faq, i) => (
              <details key={i} className="border rounded-lg p-4">
                <summary className="font-semibold cursor-pointer">{faq.question}</summary>
                <p className="mt-3 text-muted-foreground leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="my-12 text-center bg-muted/40 rounded-2xl p-8">
          <h2 className="text-2xl font-serif font-bold mb-4">{t("landingPage.readyToBook")}</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href={config.ctaListingPath} className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold">
              {t(config.category === "tour" ? "nav.viewAllTours" : "nav.viewAllTransfers")}
            </Link>
            <Link href="/contact" className="px-6 py-3 rounded-lg border border-primary text-primary font-semibold">
              {t("nav.contact")}
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}
