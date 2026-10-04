import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Hero } from "@/components/hero";
import { TourCard } from "@/components/tour-card";
import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck, Car, CheckCircle, Lock, Map as MapIcon, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/lib/api";
import { useTranslation } from "react-i18next";
import React, { useMemo } from "react";
import { useCmsText } from "@/hooks/use-cms-text";
import type { Product } from "@shared/schema";
import { PhotoCredits } from "@/components/section-backdrop";
import { PaperEdge, Polaroid, SectionLabel } from "@/components/postcard";
import { IMAGE_CREDITS } from "@/lib/image-credits";
import { keepAcrossLanguageSwitch } from "@/lib/language-placeholder";

// Postcard photos: openly licensed Efate images (credits in image-credits.ts).
// The about polaroid and hero can be swapped in Admin → CMS (about_image / hero_image).
const PHOTOS = {
  aboutWaterfall: "/assets/home/mele-cascades.webp",
  aboutBeach: "/assets/home/eratap-beach.webp",
  toursBackdrop: "/assets/home/vila-bay-ship-sunset.webp",
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

  // Brochure: the Efate Scenic Tour includes a local chocolate factory visit.
  const craft = [
    { src: "/assets/home/cocoa-pods-vila-market.webp", caption: t("home.craftCocoa", "Cocoa from the market"), rotate: -3 },
    { src: "/assets/home/port-vila-market-baskets.webp", caption: t("home.craftMarket", "Port Vila market"), rotate: 2.5 },
  ];

  // Closing call-to-action: sits on the footer's dusk photo (Layout footerLead).
  const closingCta = (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-28">
      <div className="container mx-auto px-4 text-center text-white">
        <p className="font-script text-3xl md:text-4xl text-[#ffe3c6] -rotate-2 mb-2 drop-shadow">{t("home.ctaScript", "Wish you were here...")}</p>
        <h2 className="text-4xl md:text-6xl mb-6 drop-shadow-lg">{cms.text("cta_title", t("home.ctaTitle"))}</h2>
        <div
          className="text-lg md:text-xl mb-10 max-w-2xl mx-auto text-white/90 prose prose-lg prose-invert prose-p:my-2"
          dangerouslySetInnerHTML={{ __html: cms.html("cta_desc", t("home.ctaDesc")) }}
        />
        <Link href="/tours">
          <Button size="lg" className="rounded-full bg-sunset px-10 py-7 text-lg font-semibold text-white shadow-2xl ring-2 ring-white/20 hover:bg-sunset/90">
            <CalendarCheck className="mr-2 h-5 w-5" />
            {cms.text("cta_button", t("home.ctaButton"))}
          </Button>
        </Link>
      </div>
    </section>
  );

  return (
    <Layout footerLead={closingCta}>
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
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Icon className="h-6 w-6" strokeWidth={1.9} />
                </span>
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
      <section className="relative bg-background overflow-x-clip">
        <div className="container mx-auto px-4 pt-8 pb-28 md:pt-12 md:pb-36 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-center">
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
                <li key={item} className="flex items-center gap-1.5 rounded-full border border-border bg-paper/70 px-3.5 py-1.5 text-sm text-navy">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/about" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline underline-offset-4">
              {t("home.learnMore")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <PhotoCredits credits={[IMAGE_CREDITS.meleCascades, IMAGE_CREDITS.eratap]} tone="wash" />
          </motion.div>
        </div>
      </section>

      {/* 02 · Tours: postcards scattered over a sunset on Vila Bay; torn cream paper above and teal below */}
      <section className="relative overflow-x-clip bg-harbour pt-28 pb-32 md:pt-36 md:pb-40">
        <div aria-hidden className="absolute inset-0">
          <img src={PHOTOS.toursBackdrop} alt="" loading="lazy" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/35 via-black/35 to-black/55" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-reef-light/25" />
        </div>
        <PaperEdge position="top" seed={11} />
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
              <Button size="lg" className="rounded-full bg-harbour px-8 text-white ring-2 ring-white/25 hover:bg-harbour/90">
                <MapIcon className="mr-2 h-4 w-4" />
                {t("home.viewAllTours", "View all tours")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <PhotoCredits credits={[IMAGE_CREDITS.vilaBayShip]} tone="dark" />
        </div>
        <PaperEdge position="bottom" seed={23} color="hsl(var(--reef-light))" />
      </section>

      {/* 03 · Transfers: calm lagoon-teal band with ticket cards */}
      <section className="relative bg-reef-light pt-16 pb-28 md:pt-20 md:pb-36">
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

          <Link href="/transfers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline underline-offset-4">
            <Car className="h-4 w-4" />
            {t("home.viewAllTransfers", "View all transfers")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <PaperEdge position="bottom" seed={37} />
      </section>

      {/* 04 · Local makers: cacao (the Efate Scenic Tour's chocolate factory stop) and the Port Vila market */}
      <section className="bg-background overflow-x-clip pt-16 pb-8 md:pt-20">
        <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-16 items-center">
          <div>
            <SectionLabel index={4} className="mb-4">{t("home.craftLabel", "Local makers")}</SectionLabel>
            <h2 className="text-4xl md:text-5xl text-navy mb-6">{t("home.craftTitle", "Taste & craft of Vanuatu")}</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t("home.craftDesc", "Island chocolate, cacao and hand-woven baskets. Our Efate Scenic Tour stops at a local chocolate factory, and on a private tour you choose the stops: ask us to add a local maker to your day.")}
            </p>
            <PhotoCredits credits={[IMAGE_CREDITS.cocoaPods, IMAGE_CREDITS.vilaMarket]} tone="wash" />
          </div>
          <div className="grid grid-cols-2 gap-6 md:gap-10">
            {craft.map((item, i) => (
              <Polaroid
                key={item.src}
                src={item.src}
                alt={item.caption}
                caption={item.caption}
                rotate={item.rotate}
                tape={i === 0}
                aspect="aspect-[4/5]"
                className={i === 1 ? "mt-10" : undefined}
              />
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
