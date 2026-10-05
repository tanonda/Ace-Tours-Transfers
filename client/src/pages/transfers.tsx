
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { TourCard } from "@/components/tour-card";
import { useTranslation } from "react-i18next";
import { useLocalizedTransfers } from "@/hooks/useLocalizedProducts";
import { PageHero } from "@/components/page-hero";
import { PaperEdge, SectionLabel } from "@/components/postcard";
import { Clock, Plane, Users } from "lucide-react";
import { useSitePhoto } from "@/hooks/use-site-photo";

export default function Transfers() {
  const heroPhoto = useSitePhoto("transfersHero"); // Admin → CMS
  const { t } = useTranslation();
  const { data: allTransfers = [], isLoading } = useLocalizedTransfers();

  // Deduplicate by normalized title and filter out test data
  const transfers = allTransfers.reduce<typeof allTransfers>((acc: any[], current: any) => {
    if (!current.isActive) return acc;

    const titleLower = current.title.toLowerCase();
    if (
      titleLower.includes("verification") ||
      titleLower.includes("concurrent") ||
      titleLower.includes("test_tour") ||
      titleLower.includes("phase4")
    ) {
      return acc;
    }

    const normalize = (t: string) => t.replace(/\s+Package$/i, "").trim();
    const normalizedTitle = normalize(current.title);
    const existingIndex = acc.findIndex(
      (item) => normalize(item.title) === normalizedTitle,
    );

    if (existingIndex === -1) {
      acc.push(current);
    } else if (current.isActive !== false && acc[existingIndex].isActive === false) {
      acc[existingIndex] = current;
    }
    return acc;
  }, []);

  return (
    <Layout>
      <SEO
        title={t("transfers.seoTitle", "Airport Transfers & Transport Services in Vanuatu")}
        description={t(
          "transfers.seoDesc",
          "Reliable and comfortable airport transfers, event transport, and VIP hospitality services in Vanuatu.",
        )}
      />
      <PageHero
        priority
        photo={heroPhoto}
        photoPosition="50% 55%"
        kicker={t("transfers.kicker", "Port Vila")}
        title={t("transfers.heroTitle", "Transfers")}
        subtitle={t("home.transfersDesc")}
      />

      {/* Calm lagoon-teal band, as on the home page; it tears back into the cream page above the footer. */}
      <section className="relative bg-reef-light pt-16 pb-28 md:pt-20 md:pb-36">
        <PaperEdge position="top" seed={51} />
        <div className="container mx-auto px-4">
          <div className="mb-12 grid grid-cols-1 items-end gap-6 lg:grid-cols-2">
            <div>
              <SectionLabel index={1} tone="reef" className="mb-4">{t("transfers.label", "Getting around Efate")}</SectionLabel>
              <h2 className="text-4xl text-navy md:text-5xl">{t("transfers.heading", "We'll meet you there")}</h2>
            </div>
            <ul className="flex flex-wrap gap-2 lg:justify-end">
              {[
                { icon: Plane, text: t("transfers.factFlights", "Flight tracking") },
                { icon: Users, text: t("transfers.factGreet", "Meet & greet") },
                { icon: Clock, text: t("transfers.fact247", "Available 24/7") },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5 rounded-full border border-reef/30 bg-paper/70 px-3.5 py-1.5 text-sm text-navy">
                  <Icon className="h-4 w-4 text-reef" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {isLoading ? (
            <div className="text-center py-12">{t("common.loading")}</div>
          ) : (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {transfers.map((transfer: any, index: number) => (
                <TourCard key={transfer.id} tour={transfer as any} index={index} variant="ticket" />
              ))}
            </div>
          )}
        </div>
        <PaperEdge position="bottom" seed={57} />
      </section>
    </Layout>
  );
}
