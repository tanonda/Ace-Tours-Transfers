
import { useMemo } from "react";
import { Layout } from "@/components/layout";
import { TourCard } from "@/components/tour-card";
import { useQuery } from "@tanstack/react-query";
import { fetchVehicles } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@shared/schema";

export default function Vehicles() {
  const { t } = useTranslation();
  const { data: rawVehicles = [], isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: fetchVehicles,
  });

  // Filter out test data
  const vehicles = useMemo(() => {
    return rawVehicles.filter((current: any) => {
      if (current.isActive === false) return false;
      const titleLower = current.title.toLowerCase();
      return !(titleLower.includes("verification") ||
        titleLower.includes("concurrent") ||
        titleLower.includes("test_tour") ||
        titleLower.includes("phase4"));
    });
  }, [rawVehicles]);

  return (
    <Layout>
      <section className="pt-40 pb-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div className="max-w-2xl">
              <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20 border-none px-4 py-1.5 text-sm font-semibold rounded-full">
                {t('nav.vehicles')}
              </Badge>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
                {t('vehicles.title')}
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                {t('vehicles.description')}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-[400px] rounded-2xl bg-muted animate-pulse border border-border" />
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
              <p className="text-xl text-muted-foreground">{t('vehicles.noVehicles')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {vehicles.map((vehicle: Product, index: number) => (
                <TourCard key={vehicle.id} tour={vehicle as any} index={index} />
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
