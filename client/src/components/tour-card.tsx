import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Check, Eye } from "lucide-react";
import { ProductQuickView } from "@/components/product-quick-view";
import { ShareButton } from "@/components/share-button";
import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/lib/currency-context";
import { type ProductCategory, formatPriceDisplay } from "@/lib/product.types";
import { cloudinaryOpt } from "@/components/seo";

export interface ProductRouteProps {
  id: string;
  title: string;
  price: string;   // Deprecated, for fallback
  adultPriceCents: number;
  childPriceCents: number;
  duration: string;
  minPax?: string | number | null;
  childPrice?: string | null;
  description: string[];
  image: string;
  category?: ProductCategory;
  contactForPrice?: boolean;
}

export function TourCard({ tour, index }: { tour: ProductRouteProps; index: number }) {
  const [showQuickView, setShowQuickView] = useState(false);
  const { t } = useTranslation();
  const { currency } = useCurrency();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        viewport={{ once: true }}
      >
        <Card
          className="h-full flex flex-col overflow-hidden border-none shadow-lg hover:shadow-xl transition-shadow duration-300 group cursor-pointer"
          onClick={() => setShowQuickView(true)}
        >
          <div className="relative h-64 overflow-hidden bg-[#211e18]">
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors z-10" />
            {tour.image && (
              <img
                src={cloudinaryOpt(tour.image, 600)}
                alt={(tour as any).imageAlt || tour.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                loading="lazy"
                decoding="async"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="absolute top-4 left-4 z-20">
              <ShareButton title={tour.title} description={tour.description[0]} />
            </div>
            <div className="absolute top-4 right-4 z-20">
              <Badge className="bg-background/90 text-foreground hover:bg-background text-sm font-bold px-3 py-1 shadow-sm backdrop-blur-sm border border-border/50">
                {tour.contactForPrice ? t("tour.contactForPrice", "Contact for Price") : formatPriceDisplay(tour.adultPriceCents, currency as any)}
              </Badge>
            </div>
            <div className="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Button variant="secondary" size="sm" className="shadow-lg font-semibold">
                <Eye className="mr-2 h-4 w-4" /> {t("tour.quickView", "Quick View")}
              </Button>
            </div>
          </div>

          <CardHeader className="pb-2">
            <h3 className="font-serif text-2xl font-bold text-foreground group-hover:text-primary transition-colors">
              {tour.title}
            </h3>
            <div className="flex items-center gap-4 text-muted-foreground text-sm mt-2">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{tour.duration}</span>
              </div>
              {tour.minPax && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{tour.minPax}</span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-grow">
            <ul className="space-y-2 mt-2">
              {Array.isArray(tour.description) ? tour.description.map((item: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              )) : (
                typeof tour.description === "string" ? (
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{tour.description}</span>
                  </li>
                ) : null
              )}
            </ul>
          </CardContent>

          <CardFooter className="pt-4 border-t border-border/50 bg-muted/30" onClick={(e) => e.stopPropagation()}>
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center text-sm text-muted-foreground mb-2">
                <span>{tour.contactForPrice ? '' : t("tour.startingFrom", "Starting from")}</span>
                <span className="font-bold text-foreground">
                  {tour.contactForPrice ? '' : formatPriceDisplay(tour.adultPriceCents || 0, currency as any)}
                </span>
              </div>

              {tour.contactForPrice ? (
                <Link href={`/vehicles/${tour.id}`}>
                  <Button className="w-full font-semibold touch-target touch-feedback" size="lg">{t("tour.inquireNow", "View Details & Contact")}</Button>
                </Link>
              ) : (
                <Link href={`/tours/${tour.id}`}>
                  <Button className="w-full font-semibold touch-target touch-feedback" size="lg">{t("tour.viewDetails", "View Details")}</Button>
                </Link>
              )}
            </div>
          </CardFooter>
        </Card>
      </motion.div>

      {showQuickView && (
        <ProductQuickView
          isOpen={showQuickView}
          onClose={() => setShowQuickView(false)}
          product={tour as any}
        />
      )}
    </>
  );
}
