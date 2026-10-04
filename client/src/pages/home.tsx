import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Hero } from "@/components/hero";
import { TourCard } from "@/components/tour-card";
import { motion } from "framer-motion";
import { Lock, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/lib/api";
import { useTranslation } from "react-i18next";
import React, { useMemo } from "react";
import { useCmsText } from "@/hooks/use-cms-text";
import type { Product } from "@shared/schema";
import { PhotoCredits } from "@/components/section-backdrop";
import { Polaroid, SectionLabel } from "@/components/postcard";
import { IMAGE_CREDITS } from "@/lib/image-credits";
import { keepAcrossLanguageSwitch } from "@/lib/language-placeholder";

// Postcard photos: openly licensed Efate images (credits in image-credits.ts).
// The about polaroid and hero can be swapped in Admin → CMS (about_image / hero_image).
const PHOTOS = {
  aboutWaterfall: "/assets/home/mele-cascades.webp",
  aboutBeach: "/assets/home/eratap-beach.webp",
  toursBackdrop: "/assets/home/vila-bay-ship-sunset.webp",
  ctaBackdrop: "/assets/home/vila-harbour-dusk.webp",
};

export default function Home() {
  const { t, i18n } = useTranslation();
  const cms = useCmsText("home-page");
  const aboutImg = cms.text("about_image") || PHOTOS.aboutWaterfall;
  const { data: allTours = [] } = useQuery({
    queryKey: ["products", i18n.language],
    queryFn: fetchProducts,
    placeholderData: keepAcrossLanguageSwitch(["products"]),
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

  const trust = [
    { icon: ShieldCheck, title: cms.text("trust_licensed", t("trust.licensed")), desc: cms.text("trust_licensed_desc", t("trust.licensedDesc")) },
    { icon: Star, title: cms.text("trust_rated", t("trust.rated")), desc: cms.text("trust_rated_desc", t("trust.ratedDesc")) },
    { icon: Lock, title: cms.text("trust_secure", t("trust.secure")), desc: cms.text("trust_secure_desc", t("trust.secureDesc")) },
  ];

  const craft = [
    { src: "/assets/home/cocoa-pods-vila-market.webp", caption: t("home.craftCocoa", "Cocoa from the market"), rotate: -3 },
    { src: "/assets/home/port-vila-market-baskets.webp", caption: t("home.craftMarket", "Port Vila market"), rotate: 2 },
    { src: "/assets/home/island-basket.webp", caption: t("home.craftBasket", "Island basket"), rotate: -1.5, contain: true },
    { src: "/assets/home/pentecost-mat.webp", caption: t("home.craftWoven", "Woven by hand"), rotate: 3 },
  ];

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

      {/* Trust strip: plain icon + text on the cream page, as on the postcard */}
      <section className="bg-background">
        <div className="container mx-auto px-4 py-8 md:py-10">
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {trust.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-center gap-4">
                <Icon className="h-8 w-8 shrink-0 text-primary" strokeWidth={1.75} />
                <div>
                  <h3 className="font-sans text-base font-semibold text-navy">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 01 · About: two taped polaroids beside the brochure's welcome text */}
      <section className="bg-background overflow-x-clip">
        <div className="container mx-auto px-4 pt-8 pb-16 md:pt-12 md:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          <motion.div
            className="relative mx-auto w-full max-w-md lg:max-w-none h-[420px] sm:h-[480px]"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Polaroid
              src={aboutImg}
              alt={t("home.aboutPhotoAlt", "Mele Cascades waterfall, Efate")}
              caption={t("home.aboutCaption1", "Efate waterfalls")}
              rotate={-5}
              tape
              aspect="aspect-[4/5]"
              className="absolute left-0 top-0 w-[62%]"
            />
            <Polaroid
              src={PHOTOS.aboutBeach}
              alt={t("home.aboutPhoto2Alt", "Eratap beach on Efate's south coast")}
              caption={t("home.aboutCaption2", "Efate's south coast")}
              rotate={4}
              className="absolute right-0 bottom-0 w-[62%]"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <SectionLabel index={1} className="mb-4">{cms.text("about_label", t("home.aboutLabel"))}</SectionLabel>
            <h2 className="text-4xl md:text-5xl mb-6 text-navy">{cms.text("about_title", t("home.aboutTitle"))}</h2>
            <div
              className="text-lg text-muted-foreground mb-4 leading-relaxed prose prose-lg prose-p:my-2 max-w-none"
              dangerouslySetInnerHTML={{ __html: cms.html("about_desc1", t("home.aboutDesc1")) }}
            />
            <div
              className="text-lg text-muted-foreground mb-6 leading-relaxed prose prose-lg prose-p:my-2 max-w-none"
              dangerouslySetInnerHTML={{ __html: cms.html("about_desc2", t("home.aboutDesc2")) }}
            />
            <ul className="flex flex-wrap gap-2 mb-8">
              {[
                cms.text("about_badge1", t("home.fullyInsured")),
                cms.text("about_badge2", t("home.experiencedDrivers")),
                cms.text("about_badge3", t("home.customItineraries")),
                cms.text("about_badge4", t("home.safetyFirst")),
              ].map((item) => (
                <li key={item} className="rounded-full border border-border bg-paper/60 px-4 py-1.5 text-sm text-navy">{item}</li>
              ))}
            </ul>
            <Link href="/about" className="text-sm font-semibold text-primary underline underline-offset-4">
              {t("home.learnMore")} →
            </Link>
            <PhotoCredits credits={[IMAGE_CREDITS.meleCascades, IMAGE_CREDITS.eratap]} tone="wash" />
          </motion.div>
        </div>
      </section>

      {/* 02 · Tours: postcards scattered over a sunset on Vila Bay */}
      <section className="relative overflow-x-clip bg-navy py-20 md:py-28">
        <div aria-hidden className="absolute inset-0">
          <img src={PHOTOS.toursBackdrop} alt="" loading="lazy" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/60" />
        </div>
        <div className="container relative mx-auto px-4">
          <div className="mx-auto mb-14 max-w-2xl text-center text-white">
            <SectionLabel index={2} tone="light" centered className="mb-4">{cms.text("tours_label", t("home.toursLabel"))}</SectionLabel>
            <h2 className="text-4xl md:text-6xl drop-shadow-lg">{cms.text("tours_title", t("home.toursTitle"))}</h2>
            <div
              className="mt-4 text-lg text-white/85 prose prose-lg prose-invert prose-p:my-1 mx-auto"
              dangerouslySetInnerHTML={{ __html: cms.html("tours_desc", t("home.toursDesc")) }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-8 mb-14">
            {toursList.slice(0, 3).map((tour: any, index: number) => (
              <TourCard key={tour.id} tour={{ ...tour, category: tour.category as any }} index={index} variant="postcard" />
            ))}
          </div>

          <div className="text-center">
            <Link href="/tours">
              <Button size="lg" className="rounded-full bg-navy px-8 text-white hover:bg-navy/90">{t("home.viewAllTours", "View all tours")}</Button>
            </Link>
          </div>
          <PhotoCredits credits={[IMAGE_CREDITS.vilaBayShip]} tone="dark" />
        </div>
      </section>

      {/* 03 · Transfers: calm lagoon-teal band with ticket cards */}
      <section className="bg-reef-light py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mb-12 max-w-2xl">
            <SectionLabel index={3} tone="reef" className="mb-4">{cms.text("transfers_label", t("home.transfersLabel", "Airport & Hotel"))}</SectionLabel>
            <h2 className="text-4xl md:text-5xl text-navy">{cms.text("transfers_title", t("home.transfersTitle"))}</h2>
            <div
              className="mt-4 text-lg text-muted-foreground prose prose-lg prose-p:my-1"
              dangerouslySetInnerHTML={{ __html: cms.html("transfers_desc", t("home.transfersDesc")) }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {transfers.slice(0, 3).map((transfer: any, index: number) => (
              <TourCard key={transfer.id} tour={{ ...transfer, category: transfer.category as any }} index={index} variant="ticket" />
            ))}
          </div>

          <Link href="/transfers" className="text-sm font-semibold text-primary underline underline-offset-4">
            {t("home.viewAllTransfers", "View all transfers")} →
          </Link>
        </div>
      </section>

      {/* 04 · Local makers: Efate Scenic Tour visits a chocolate factory; private tours can add a maker */}
      <section className="bg-background overflow-x-clip py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mb-14 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-16 items-end">
            <div>
              <SectionLabel index={4} className="mb-4">{t("home.craftLabel", "Local makers")}</SectionLabel>
              <h2 className="text-4xl md:text-5xl text-navy">{t("home.craftTitle", "Taste & craft of Vanuatu")}</h2>
            </div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("home.craftDesc", "Island chocolate, cacao and hand-woven baskets. Our Efate Scenic Tour stops at a local chocolate factory, and on a private tour you choose the stops: ask us to add a local maker to your day.")}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
            {craft.map((item) => (
              <Polaroid
                key={item.src}
                src={item.src}
                alt={item.caption}
                caption={item.caption}
                rotate={item.rotate}
                contain={item.contain}
                aspect="aspect-square"
              />
            ))}
          </div>
          <PhotoCredits credits={[IMAGE_CREDITS.cocoaPods, IMAGE_CREDITS.vilaMarket, IMAGE_CREDITS.islandBasket, IMAGE_CREDITS.pentecostMat]} tone="wash" />
        </div>
      </section>

      {/* CTA: "Wish you were here..." over Port Vila Harbour at dusk */}
      <section className="relative overflow-x-clip bg-navy py-24 md:py-36">
        <div aria-hidden className="absolute inset-0">
          <img src={PHOTOS.ctaBackdrop} alt="" loading="lazy" className="h-full w-full object-cover object-[50%_45%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-black/45 to-black/75" />
        </div>
        <div className="container relative mx-auto px-4 text-center text-white">
          <p className="font-script text-3xl md:text-4xl text-[#f3c9a8] -rotate-2 mb-2">{t("home.ctaScript", "Wish you were here...")}</p>
          <h2 className="text-4xl md:text-6xl mb-6 drop-shadow-lg">{cms.text("cta_title", t("home.ctaTitle"))}</h2>
          <div
            className="text-lg md:text-xl mb-10 max-w-2xl mx-auto text-white/90 prose prose-lg prose-invert prose-p:my-2"
            dangerouslySetInnerHTML={{ __html: cms.html("cta_desc", t("home.ctaDesc")) }}
          />
          <Link href="/tours">
            <Button size="lg" className="rounded-full bg-sunset px-10 py-7 text-lg font-semibold text-white shadow-2xl hover:bg-sunset/90">
              {cms.text("cta_button", t("home.ctaButton"))}
            </Button>
          </Link>
          <PhotoCredits credits={[IMAGE_CREDITS.vilaHarbourDusk]} tone="dark" />
        </div>
      </section>
    </Layout>
  );
}
