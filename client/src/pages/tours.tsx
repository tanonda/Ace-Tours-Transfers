
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { TourCard } from "@/components/tour-card";
import { useTranslation } from "react-i18next";
import { useLocalizedTours } from "@/hooks/useLocalizedProducts";
import { cleanProductList } from "@/lib/product-filters";

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
          "Discover our range of meticulously planned tours in Vanuatu. From scenic cultural tours to vehicle hire for large groups.",
        )}
      />
      <div className="bg-muted/30 pt-48 md:pt-40 pb-20">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-serif font-bold text-center mb-6">
            {t("home.toursTitle")}
          </h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-12 text-lg">
            {t("home.toursDesc")}
          </p>
          {isLoading ? (
            <div className="text-center py-12">{t("common.loading")}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {toursList.map((tour: any, index: number) => (
                <TourCard
                  key={tour.id}
                  tour={{ ...tour, category: tour.category as any }}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
