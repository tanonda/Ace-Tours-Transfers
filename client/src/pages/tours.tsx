import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { TourCard } from "@/components/tour-card";
import { useTranslation } from "react-i18next";
import { useLocalizedTours } from "@/hooks/useLocalizedProducts";
import { cleanProductList } from "@/lib/product-filters";
import { PageHero } from "@/components/page-hero";
import { SectionLabel } from "@/components/postcard";
import { IMAGE_CREDITS } from "@/lib/image-credits";
import { CalendarCheck, ShieldCheck, Users } from "lucide-react";

export default function Tours() {
  const { t } = useTranslation();
  const { data: allTours = [], isLoading } = useLocalizedTours();

  const toursList = cleanProductList(allTours);

  return (
    <Layout>
      <SEO
        title={t("tours.seoTitle", "Our Tours - Explore Vanuatu's Best Attractions")}
        description={t(
          "tours.seoDesc",
          "Discover our range of meticulously planned tours in Vanuatu. From scenic cultural tours to full-day private charters for groups.",
        )}
      />
      <PageHero
        priority
        photo="/assets/home/blue-lagoon-efate.webp"
        photoPosition="50% 55%"
        kicker={t("tours.kicker", "Efate Island")}
        title={t("tours.heroTitle", "Day Tours")}
        subtitle={t("home.toursDesc")}
        credit={IMAGE_CREDITS.blueLagoon}
      />

      <section className="bg-background pt-10 pb-24 md:pt-14">
        <div className="container mx-auto px-4">
          <div className="mb-14 grid grid-cols-1 items-end gap-6 lg:grid-cols-2">
            <div>
              <SectionLabel index={1} className="mb-4">{t("tours.packagesLabel", "Our packages")}</SectionLabel>
              <h2 className="text-4xl text-navy md:text-5xl">{t("tours.pickYourDay", "Pick your day on Efate")}</h2>
            </div>
            <ul className="flex flex-wrap gap-2 lg:justify-end">
              {[
                // Claims the site already makes (About badges, trust strip); nothing new.
                { icon: Users, text: t("tours.factGuides", "Local guides") },
                { icon: ShieldCheck, text: t("tours.factInsured", "Fully insured") },
                { icon: CalendarCheck, text: t("tours.factInstant", "Instant confirmation") },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5 rounded-full border border-border bg-paper/70 px-3.5 py-1.5 text-sm text-navy">
                  <Icon className="h-4 w-4 text-primary" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {isLoading ? (
            <div className="text-center py-12">{t("common.loading")}</div>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
              {toursList.map((tour: any, index: number) => (
                <TourCard
                  key={tour.id}
                  tour={{ ...tour, category: tour.category as any }}
                  index={index}
                  variant="postcard"
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
