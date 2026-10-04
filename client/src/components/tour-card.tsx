import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Car, Clock, Eye, Users } from "lucide-react";
import { ProductQuickView } from "@/components/product-quick-view";
import { ShareButton } from "@/components/share-button";
import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/lib/currency-context";
import { type ProductCategory, formatPriceDisplay, getDisplayPrice } from "@/lib/product.types";
import { getProductImage } from "@/lib/product-images";
import { cloudinaryOpt } from "@/components/seo";
import { PriceStamp } from "@/components/postcard";
import { shortDuration } from "@/lib/postcard-format";

// Simple utility to strip HTML but keep text content
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, '');
}

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
  pricingType?: string | null;
  groupPriceCents?: number | null;
}

function firstDescription(description: ProductRouteProps["description"]): string {
  if (Array.isArray(description) && description.length > 0) return stripHtml(description[0]);
  return typeof description === "string" ? stripHtml(description) : "";
}

// SEO titles carry " | keyword" tails; cards show the product name only.
function cardTitle(title: string): string {
  return title.split(" | ")[0];
}

const POSTCARD_TILT = [-2, 1.5, -1];

/**
 * - "default": the catalogue card (listing pages).
 * - "postcard": tilted paper card with a stamp price tag (home tours).
 * - "ticket": flat paper card with a round duration badge (home transfers).
 */
export type TourCardVariant = "default" | "postcard" | "ticket";

export function TourCard({ tour, index, variant = "default" }: { tour: ProductRouteProps; index: number; variant?: TourCardVariant }) {
  if (variant === "postcard") return <PostcardTourCard tour={tour} index={index} />;
  if (variant === "ticket") return <TicketTourCard tour={tour} index={index} />;
  return <DefaultTourCard tour={tour} index={index} />;
}

function PostcardTourCard({ tour, index }: { tour: ProductRouteProps; index: number }) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const displayImage = getProductImage(tour.image);
  const shownPrice = getDisplayPrice(tour);
  const detailHref = `/${tour.category === "transfer" ? "transfers" : "tours"}/${tour.id}`;
  const meta = [tour.duration, tour.minPax].filter(Boolean).join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="h-full"
    >
      <Link href={detailHref} className="group block h-full">
        <article
          className="relative h-full bg-paper p-3 pb-7 shadow-[0_22px_50px_-18px_rgba(0,0,0,0.55)] transition-transform duration-500 group-hover:-translate-y-1.5"
          style={{ rotate: `${POSTCARD_TILT[index % POSTCARD_TILT.length]}deg` }}
        >
          <div className="aspect-[4/3] overflow-hidden bg-muted">
            {displayImage && (
              <img
                src={cloudinaryOpt(displayImage, 600)}
                alt={(tour as any).imageAlt || tour.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
          {!tour.contactForPrice && (
            <PriceStamp
              className="absolute -top-2 right-3"
              label={shownPrice.isPackage ? t("tour.package", "Package") : t("tour.from", "From")}
              price={formatPriceDisplay(shownPrice.amount, currency as any)}
            />
          )}
          <div className="px-3 pt-5">
            {meta && <p className="font-script text-xl text-primary leading-none">{meta}</p>}
            <h3 className="mt-2 font-serif text-2xl md:text-[1.65rem] text-navy leading-tight">{cardTitle(tour.title)}</h3>
            <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{firstDescription(tour.description)}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline underline-offset-4">
              {tour.contactForPrice ? t("tour.inquireNow", "View Details & Contact") : t("tour.viewDetails", "View Details")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

function TicketTourCard({ tour, index }: { tour: ProductRouteProps; index: number }) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const displayImage = getProductImage(tour.image);
  const shownPrice = getDisplayPrice(tour);
  const detailHref = `/${tour.category === "transfer" ? "transfers" : "tours"}/${tour.id}`;
  const badge = shortDuration(tour.duration);
  const tagline = firstDescription(tour.description).split(/(?<=[.!?])\s/)[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="h-full"
    >
      <Link href={detailHref} className="group block h-full">
        <article className="flex h-full flex-col bg-paper border-l-2 border-dashed border-reef/30 shadow-[0_18px_40px_-20px_rgba(18,50,74,0.35)] transition-transform duration-500 group-hover:-translate-y-1">
          <div className="aspect-[16/10] overflow-hidden bg-muted">
            {displayImage && (
              <img
                src={cloudinaryOpt(displayImage, 600)}
                alt={(tour as any).imageAlt || tour.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
          <div className="flex flex-1 flex-col p-6">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-serif text-2xl text-navy leading-tight">{cardTitle(tour.title)}</h3>
              {badge && (
                <span className="grid size-16 shrink-0 place-content-center rounded-full border-2 border-reef text-center text-[0.65rem] font-bold leading-tight text-reef">
                  {badge.split(" ").map((part) => <span key={part} className="block">{part}</span>)}
                </span>
              )}
            </div>
            {tagline && (
              // Padding/border on a wrapper: on the clamped element they would reveal part of line 2.
              <div className="mt-3 border-b border-border pb-3">
                <p className="font-script text-xl text-navy/80 line-clamp-1">{tagline}</p>
              </div>
            )}
            {!tour.contactForPrice && (
              <p className="mt-3 text-sm text-muted-foreground">
                {shownPrice.isPackage ? t("tour.packageRate", "Package rate") : t("tour.startingFrom", "Starting from")}{" "}
                <strong className="text-navy">{formatPriceDisplay(shownPrice.amount, currency as any)}</strong>
              </p>
            )}
            <span className="mt-auto pt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline underline-offset-4">
              <Car className="h-4 w-4" />
              {t("tour.bookTransfer", "Book transfer")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

function DefaultTourCard({ tour, index }: { tour: ProductRouteProps; index: number }) {
  const [showQuickView, setShowQuickView] = useState(false);
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const displayImage = getProductImage(tour.image);
  const shownPrice = getDisplayPrice(tour);
  const detailHref = `/${tour.category === "transfer" ? "transfers" : "tours"}/${tour.id}`;

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
          <div className="relative aspect-video overflow-hidden bg-[#211e18]">
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors z-10" />
            {displayImage && (
              <img
                src={cloudinaryOpt(displayImage, 600)}
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
                {tour.contactForPrice ? t("tour.contactForPrice", "Contact for Price") : formatPriceDisplay(shownPrice.amount, currency as any)}
              </Badge>
            </div>
            <div className="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Button variant="secondary" size="sm" className="shadow-lg font-semibold">
                <Eye className="mr-2 h-4 w-4" /> {t("tour.quickView", "Quick View")}
              </Button>
            </div>
          </div>

          <CardHeader className="pb-2">
            <h3 className="font-serif text-2xl text-foreground group-hover:text-primary transition-colors">
              {cardTitle(tour.title)}
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

          <CardContent className="flex-grow flex flex-col justify-start overflow-hidden">
            <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mt-1">
              {Array.isArray(tour.description) && tour.description.length > 0
                ? stripHtml(tour.description[0])
                : typeof tour.description === "string"
                  ? stripHtml(tour.description)
                  : ""}
            </p>
          </CardContent>

          <CardFooter className="pt-4 border-t border-border/50 bg-muted/30" onClick={(e) => e.stopPropagation()}>
            <div className="w-full space-y-2">
              <div className="flex justify-between items-center text-sm text-muted-foreground mb-2">
                <span>{tour.contactForPrice ? '' : shownPrice.isPackage ? t("tour.packageRate", "Package rate") : t("tour.startingFrom", "Starting from")}</span>
                <span className="font-bold text-foreground">
                  {tour.contactForPrice ? '' : formatPriceDisplay(shownPrice.amount, currency as any)}
                </span>
              </div>

              {tour.contactForPrice ? (
                <Link href={detailHref}>
                  <Button className="w-full font-semibold touch-target touch-feedback" size="lg">{t("tour.inquireNow", "View Details & Contact")}</Button>
                </Link>
              ) : (
                <Link href={detailHref}>
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
