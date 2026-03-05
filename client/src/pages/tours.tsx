
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { TourCard } from "@/components/tour-card";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/lib/api";
import { useTranslation } from "react-i18next";

export default function Tours() {
  const { t } = useTranslation();
  const { data: allTours = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  // Deduplicate by normalized title and filter out test data
  const uniqueTours = allTours.reduce<typeof allTours>((acc: any[], current: any) => {
    // Skip test data
    const titleLower = current.title.toLowerCase();
    if (titleLower.includes("verification") ||
      titleLower.includes("concurrent") ||
      titleLower.includes("test_tour") ||
      titleLower.includes("phase4")) {
      return acc;
    }

    const normalize = (t: string) => t.replace(/\s+Package$/i, "").trim();
    const normalizedTitle = normalize(current.title);

    const existingIndex = acc.findIndex(item => normalize(item.title) === normalizedTitle);

    if (existingIndex === -1) {
      acc.push(current);
    } else if (current.isActive !== false && acc[existingIndex].isActive === false) {
      // Prioritize active product over inactive product with same title
      acc[existingIndex] = current;
    }
    return acc;
  }, []);

  const toursList = uniqueTours.filter((t: any) => t.category === "tour" && t.isActive !== false);

  return (
    <Layout>
      <SEO
        title={t("tours.seoTitle", "Our Tours - Explore Vanuatu's Best Attractions")}
        description={t("tours.seoDesc", "Discover our range of meticulously planned tours in Vanuatu. From scenic cultural tours to vehicle hire for large groups.")}
      />
      <div className="bg-muted/30 pt-40 pb-20">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-serif font-bold text-center mb-6">{t("home.toursTitle")}</h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-12 text-lg">
            {t("home.toursDesc")}
          </p>
          {isLoading ? (
            <div className="text-center py-12">{t("common.loading")}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {toursList.map((tour: any, index: number) => (
                <TourCard key={tour.id} tour={{ ...tour, category: tour.category as any }} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
