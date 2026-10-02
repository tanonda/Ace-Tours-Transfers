
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Hero } from "@/components/hero";
import { TourCard } from "@/components/tour-card";
import { motion } from "framer-motion";
import { CheckCircle, MapPin, Shield, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/lib/api";
import { useTranslation } from "react-i18next";
import React, { useMemo } from "react";
import { useCmsText } from "@/hooks/use-cms-text";
import type { Product } from "@shared/schema";
import { SectionBackdrop, PropLayer, PhotoWash, PhotoCredits, type BackdropProp } from "@/components/section-backdrop";
import { IMAGE_CREDITS } from "@/lib/image-credits";

// Decorative cut-outs per section. Positions are relative to the card grid
// (or CTA content); props sit behind the content and peek out around it.
const TOURS_PROPS: BackdropProp[] = [
  // Tablet: fills the empty cell beside the lone 3rd card. Desktop: under the first card.
  { src: "/assets/home/pandanus-basket.webp", className: "md:right-0 md:bottom-16 md:w-[44%] md:rotate-6 lg:right-auto lg:-bottom-16 lg:-left-32 lg:w-80 lg:-rotate-12" },
  { src: "/assets/home/snorkel-gear.webp", className: "-top-20 -right-16 lg:-right-24 w-48 lg:w-60 rotate-[18deg]" },
];

const TRANSFERS_PROPS: BackdropProp[] = [
  // Tucked under the first card's bottom-left corner on tablet and desktop.
  { src: "/assets/home/straw-hat.webp", className: "-bottom-12 -left-10 lg:-left-28 w-64 lg:w-80 -rotate-6" },
  // Vanuatu island basket (Port Vila market). Tablet: fills the gap beside the lone 3rd card, its
  // photo-cropped left edge hidden behind that card. Desktop: peeks out behind the last card.
  { src: "/assets/home/island-basket.webp", className: "md:left-[44%] md:bottom-8 md:w-[34%] md:-rotate-3 lg:left-auto lg:bottom-auto lg:-top-16 lg:-right-20 lg:w-52 lg:rotate-12" },
];

const CTA_PROPS: BackdropProp[] = [
  { src: "/assets/home/frangipani.webp", className: "-top-40 left-[4%] w-36 lg:w-44 rotate-12", showOnMobile: false },
  { src: "/assets/home/frangipani.webp", className: "-top-28 left-[13%] w-24 lg:w-28 -rotate-[25deg]" },
  { src: "/assets/home/frangipani.webp", className: "-top-36 right-[6%] w-28 lg:w-36 rotate-45" },
];

export default function Home() {
  const { t, i18n } = useTranslation();
  const cms = useCmsText("home-page");
  const aboutImg = cms.text("about_image") || "https://res.cloudinary.com/dwro1dh5q/image/upload/v1764939968/ace-tours-stock/1764939966139_vanuatu_rarru_waterf_a12f619f.jpg.jpg";
  const { data: allTours = [] } = useQuery({
    queryKey: ["products", i18n.language],
    queryFn: fetchProducts,
  });

  // Deduplicate tours by normalized title
  const uniqueTours = useMemo(() => {
    return allTours.reduce<Product[]>((acc: Product[], current: Product) => {
      // Skip test data with safety checks
      if (!current?.title) return acc;
      if (current.isActive === false) return acc;
      const titleLower = current.title.toLowerCase();
      if (titleLower.includes("verification") ||
        titleLower.includes("concurrent") ||
        titleLower.includes("test_tour") ||
        titleLower.includes("test") ||
        titleLower.includes("phase4")) {
        return acc;
      }

      // Skip services with test placeholder images
      if (current.image === "test.jpg" || current.image === "/test.jpg") {
        return acc;
      }


      const normalize = (t: string) => t.replace(/\s+Package$/i, "").trim();
      const normalizedTitle = normalize(current.title);

      const existingIndex = acc.findIndex((item: any) => {
        if (!item?.title) return false;
        return normalize(item.title) === normalizedTitle;
      });

      if (existingIndex === -1) {
        acc.push(current);
      }
      return acc;
    }, []);
  }, [allTours]);

  const toursList = useMemo(() => uniqueTours.filter((t: Product) => t.category === "tour"), [uniqueTours]);
  const transfers = useMemo(() => uniqueTours.filter((t: Product) => t.category === "transfer"), [uniqueTours]);

  return (
    <Layout>
      <SEO
        title={t("home.seoTitle", "Ace Tours & Transfers - Private Tours in Vanuatu")}
        description={t("home.seoDesc", "Experience the best of Vanuatu with Ace Tours & Transfers. Meticulously pre-planned and custom-designed tour packages in Port Vila.")}
        structuredType="LocalBusiness"
        isHomePage
        keywords={["Vanuatu tours", "Port Vila tours", "Efate tours", "Vanuatu airport transfer", "things to do in Port Vila"]}
      />
      <Hero />

      {/* Trust Indicators - Why Choose Us */}
      <section className="py-8 md:py-12 bg-primary/5 border-b border-primary/10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <div className="flex items-center gap-4 p-4 bg-background rounded-xl shadow-sm border border-border/50">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{cms.text("trust_licensed", t("trust.licensed"))}</h3>
                <p className="text-sm text-muted-foreground">{cms.text("trust_licensed_desc", t("trust.licensedDesc"))}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-background rounded-xl shadow-sm border border-border/50">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <Star className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{cms.text("trust_rated", t("trust.rated"))}</h3>
                <p className="text-sm text-muted-foreground">{cms.text("trust_rated_desc", t("trust.ratedDesc"))}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-background rounded-xl shadow-sm border border-border/50">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{cms.text("trust_secure", t("trust.secure"))}</h3>
                <p className="text-sm text-muted-foreground">{cms.text("trust_secure_desc", t("trust.secureDesc"))}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section Edge-to-Edge Split */}
      <section className="bg-muted/30 overflow-hidden relative border-y border-border/10">
        <div className="flex flex-col lg:flex-row w-full">
          {/* Base Layout: Edge to Edge Image */}
          <motion.div
            className="w-full lg:w-1/2 min-h-[400px] lg:min-h-auto relative"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <img
              src={aboutImg}
              alt="Vanuatu Waterfall"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            {/* The Quote Block */}
            <div className="absolute bottom-6 right-6 bg-card p-6 rounded-xl shadow-xl max-w-xs hidden md:block border border-border/50 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-default z-10">
              <p className="font-serif text-lg italic text-foreground">"{cms.text("about_quote", t("home.quote"))}"</p>
            </div>
          </motion.div>

          {/* Text Container Half: washed-out Toniliu village road (Efate), carved tamtam rising from the bottom edge */}
          <motion.div
            className="relative overflow-hidden w-full lg:w-1/2 flex items-center justify-center py-16 px-6 sm:px-12 lg:px-20 xl:px-28"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <PhotoWash
              tone="wash"
              photo="/assets/home/toniliu-village.webp"
              photoPosition="50% 40%"
              washClassName="from-background/75 via-background/85 to-background/90"
              className="inset-0"
            />
            <img
              src="/assets/home/tamtam.webp"
              alt=""
              aria-hidden
              loading="lazy"
              className="hidden md:block pointer-events-none select-none absolute -bottom-10 -right-3 xl:right-0 h-[320px] lg:h-[380px] drop-shadow-xl"
            />
            <div className="relative w-full max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="h-px w-12 bg-primary"></span>
                <span className="text-primary font-semibold uppercase tracking-wider text-sm">{cms.text("about_label", t("home.aboutLabel"))}</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">{cms.text("about_title", t("home.aboutTitle"))}</h2>
              <div
                className="text-lg text-muted-foreground mb-6 leading-relaxed prose prose-lg prose-p:my-2"
                dangerouslySetInnerHTML={{ __html: cms.html("about_desc1", t("home.aboutDesc1")) }}
              />
              <div
                className="text-lg text-muted-foreground mb-8 leading-relaxed prose prose-lg prose-p:my-2"
                dangerouslySetInnerHTML={{ __html: cms.html("about_desc2", t("home.aboutDesc2")) }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {[
                  cms.text("about_badge1", t("home.fullyInsured")),
                  cms.text("about_badge2", t("home.experiencedDrivers")),
                  cms.text("about_badge3", t("home.customItineraries")),
                  cms.text("about_badge4", t("home.safetyFirst")),
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle className="text-primary h-5 w-5" />
                    <span className="font-medium">{item}</span>
                  </div>
                ))}
              </div>

              <Link href="/about">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white bg-background/80">{t("home.learnMore")}</Button>
              </Link>

              <PhotoCredits credits={[IMAGE_CREDITS.toniliu, IMAGE_CREDITS.tamtam]} tone="wash" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tours Section: washed-out Blue Lagoon fading into reef blue, beach props tucked behind the cards */}
      <SectionBackdrop
        tone="wash"
        photo="/assets/home/blue-lagoon-efate.webp"
        photoPosition="50% 60%"
        washClassName="from-background/70 via-reef-light/75 to-reef-light"
        credits={[IMAGE_CREDITS.blueLagoon, IMAGE_CREDITS.pandanusBag, IMAGE_CREDITS.snorkelGear]}
        className="py-16 md:py-24 bg-reef-light"
      >
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-16">
          <span className="text-primary font-semibold uppercase tracking-wider text-sm mb-2 block">{cms.text("tours_label", t("home.toursLabel"))}</span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">{cms.text("tours_title", t("home.toursTitle"))}</h2>
          <div
            className="text-lg text-muted-foreground prose prose-lg prose-p:my-1 mx-auto"
            dangerouslySetInnerHTML={{ __html: cms.html("tours_desc", t("home.toursDesc")) }}
          />
        </div>

        <PropLayer props={TOURS_PROPS} className="mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {toursList.slice(0, 3).map((tour: any, index: number) => (
              <TourCard key={tour.id} tour={{ ...tour, category: tour.category as any }} index={index} />
            ))}
          </div>
        </PropLayer>

        <div className="text-center">
          <Link href="/tours">
            <Button variant="outline" size="lg" className="border-primary text-primary hover:bg-primary hover:text-white bg-background/80">
              View All Tours
            </Button>
          </Link>
        </div>
      </SectionBackdrop>

      {/* Transfers Section: washed-out Iririki ferry crossing, on cream so it alternates with the reef-blue Tours section */}
      <SectionBackdrop
        tone="wash"
        photo="/assets/home/iririki-port-vila.webp"
        photoPosition="50% 55%"
        washClassName="from-background/70 via-background/80 to-background"
        credits={[IMAGE_CREDITS.iririki, IMAGE_CREDITS.strawHat, IMAGE_CREDITS.islandBasket]}
        className="py-16 md:py-24 bg-background"
      >
        <div className="text-center max-w-3xl mx-auto mb-8 md:mb-16">
          <span className="text-primary font-semibold uppercase tracking-wider text-sm mb-2 block">{cms.text("transfers_label", t("home.transfersLabel", "Airport & Hotel"))}</span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">{cms.text("transfers_title", t("home.transfersTitle"))}</h2>
          <div
            className="text-lg text-muted-foreground prose prose-lg prose-p:my-1 mx-auto"
            dangerouslySetInnerHTML={{ __html: cms.html("transfers_desc", t("home.transfersDesc")) }}
          />
        </div>

        <PropLayer props={TRANSFERS_PROPS} className="mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {transfers.slice(0, 3).map((transfer: any, index: number) => (
              <TourCard key={transfer.id} tour={{ ...transfer, category: transfer.category as any }} index={index} />
            ))}
          </div>
        </PropLayer>

        <div className="text-center">
          <Link href="/transfers">
            <Button variant="outline" size="lg" className="border-primary text-primary hover:bg-primary hover:text-white bg-background/80">
              View All Transfers
            </Button>
          </Link>
        </div>
      </SectionBackdrop>

      {/* CTA Section: Erakor Bridge at sunset under a dark scrim, frangipani spilling over the top edge */}
      <SectionBackdrop
        tone="dark"
        photo="/assets/home/erakor-sunset.webp"
        photoPosition="50% 65%"
        credits={[IMAGE_CREDITS.erakorSunset, IMAGE_CREDITS.frangipani]}
        className="py-16 md:py-24 bg-neutral-900"
      >
        <PropLayer props={CTA_PROPS}>
          <div className="text-center text-white">
            <h2 className="text-4xl md:text-6xl font-bold mb-8 font-serif drop-shadow-lg">{cms.text("cta_title", t("home.ctaTitle"))}</h2>
            <div
              className="text-xl md:text-2xl mb-10 max-w-2xl mx-auto opacity-90 prose prose-xl prose-invert prose-p:my-2"
              dangerouslySetInnerHTML={{ __html: cms.html("cta_desc", t("home.ctaDesc")) }}
            />
            <Link href="/tours">
              <Button size="lg" className="font-bold px-10 py-8 text-xl shadow-2xl">{cms.text("cta_button", t("home.ctaButton"))}</Button>
            </Link>
          </div>
        </PropLayer>
      </SectionBackdrop>
    </Layout>
  );
}



