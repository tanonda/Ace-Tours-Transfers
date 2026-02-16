
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { TourCard } from "@/components/tour-card";
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";
import { useTranslation } from "react-i18next";

export default function Transfers() {
  const { t } = useTranslation();
  const { data: allTours = [], isLoading } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  // Deduplicate by normalized title and filter out test data
  const uniqueTours = allTours.reduce<typeof allTours>((acc, current) => {
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
    }
    return acc;
  }, []);

  const transfers = uniqueTours.filter(t => t.category === "transfer");

  return (
    <Layout>
      <SEO
        title={t("transfers.seoTitle", "Airport Transfers & Transport Services in Vanuatu")}
        description={t("transfers.seoDesc", "Reliable and comfortable airport transfers, event transport, and VIP hospitality services in Vanuatu.")}
      />
      <div className="bg-muted/30 pt-40 pb-20">
        <div className="container mx-auto px-4">
          <h1 className="text-5xl font-serif font-bold text-center mb-6">{t("home.transfersTitle")}</h1>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-16 text-lg">
            {t("home.transfersDesc")}
          </p>

          {isLoading ? (
            <div className="text-center py-12">{t("common.loading")}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {transfers.map((transfer, index) => (
                <TourCard key={transfer.id} tour={transfer} index={index} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
