
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Hero } from "@/components/hero";
import { TourCard } from "@/components/tour-card";
import { motion } from "framer-motion";
import { CheckCircle, MapPin, Shield, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";
import { useTranslation } from "react-i18next";
import React, { useMemo } from "react";
import { useCmsText } from "@/hooks/use-cms-text";

// Using Cloudinary URL instead of local import
const aboutImg = "https://res.cloudinary.com/dwro1dh5q/image/upload/v1764939968/ace-tours-stock/1764939966139_vanuatu_rarru_waterf_a12f619f.jpg.jpg";

export default function Home() {
  const { t } = useTranslation();
  const cms = useCmsText("home");
  const { data: allTours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  // Deduplicate tours by normalized title
  const uniqueTours = useMemo(() => {
    return allTours.reduce<typeof allTours>((acc, current) => {
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

      const existingIndex = acc.findIndex(item => {
        if (!item?.title) return false;
        return normalize(item.title) === normalizedTitle;
      });

      if (existingIndex === -1) {
        acc.push(current);
      }
      return acc;
    }, []);
  }, [allTours]);

  const toursList = useMemo(() => uniqueTours.filter(t => t.category === "tour"), [uniqueTours]);
  const transfers = useMemo(() => uniqueTours.filter(t => t.category === "transfer"), [uniqueTours]);
  const vehicles = useMemo(() => uniqueTours.filter(t => t.category === "vehicle"), [uniqueTours]);

  return (
    <Layout>
      <SEO
        title={t("home.seoTitle", "Ace Tours & Transfers - Private Tours in Vanuatu")}
        description={t("home.seoDesc", "Experience the best of Vanuatu with Ace Tours & Transfers. Meticulously pre-planned and custom-designed tour packages in Port Vila.")}
        structuredType="LocalBusiness"
        keywords={["Vanuatu tours", "Port Vila tours", "Efate tours", "Vanuatu airport transfer", "car hire Vanuatu", "things to do in Port Vila"]}
      />
      <Hero />

      {/* Trust Indicators - Why Choose Us */}
      <section className="py-12 bg-primary/5 border-b border-primary/10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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

      {/* About Section */}
      <section className="py-20 bg-muted/30 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div
              className="lg:w-1/2"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="relative">
                <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full -z-10" />
                <img
                  src={aboutImg}
                  alt="Vanuatu Waterfall"
                  className="rounded-2xl shadow-2xl w-full object-cover aspect-[4/3]"
                />
                <div className="absolute -bottom-6 -right-6 bg-card p-6 rounded-xl shadow-xl max-w-xs hidden md:block border border-border/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/30 hover:-translate-y-1 cursor-default">
                  <p className="font-serif text-lg italic text-foreground">"{cms.text("about_quote", t("home.quote"))}"</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              className="lg:w-1/2"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="h-px w-12 bg-primary"></span>
                <span className="text-primary font-semibold uppercase tracking-wider text-sm">{cms.text("about_label", t("home.aboutLabel"))}</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">{cms.text("about_title", t("home.aboutTitle"))}</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                {cms.text("about_desc1", t("home.aboutDesc1"))}
              </p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                {cms.text("about_desc2", t("home.aboutDesc2"))}
              </p>

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

              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">{t("home.learnMore")}</Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Tours Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-primary font-semibold uppercase tracking-wider text-sm mb-2 block">{cms.text("tours_label", t("home.toursLabel"))}</span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">{cms.text("tours_title", t("home.toursTitle"))}</h2>
            <p className="text-lg text-muted-foreground">{cms.text("tours_desc", t("home.toursDesc"))}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {toursList.map((tour, index) => (
              <TourCard key={tour.id} tour={{ ...tour, category: tour.category as any }} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Transfers Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-primary font-semibold uppercase tracking-wider text-sm mb-2 block">{cms.text("transfers_label", t("home.transfersLabel", "Airport & Hotel"))}</span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">{cms.text("transfers_title", t("home.transfersTitle"))}</h2>
            <p className="text-lg text-muted-foreground">{cms.text("transfers_desc", t("home.transfersDesc"))}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {transfers.map((transfer, index) => (
              <TourCard key={transfer.id} tour={{ ...transfer, category: transfer.category as any }} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Vehicle Hire Section */}
      {vehicles.length > 0 && (
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-primary font-semibold uppercase tracking-wider text-sm mb-2 block">{cms.text("vehicles_label", t("vehicles.label", "Self-Drive"))}</span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">{cms.text("vehicles_title", t("vehicles.title", "Vehicle Hire"))}</h2>
              <p className="text-lg text-muted-foreground">{cms.text("vehicles_desc", t("vehicles.description", "Explore Vanuatu at your own pace with our reliable vehicle hire service."))}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {vehicles.slice(0, 3).map((vehicle, index) => (
                <TourCard key={vehicle.id} tour={{ ...vehicle, category: vehicle.category as any }} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="container mx-auto px-4 relative text-center text-white">
          <h2 className="text-4xl md:text-6xl font-bold mb-8 font-serif">{cms.text("cta_title", t("home.ctaTitle"))}</h2>
          <p className="text-xl md:text-2xl mb-10 max-w-2xl mx-auto opacity-90">{cms.text("cta_desc", t("home.ctaDesc"))}</p>
          <Link href="/reservations?tab=book-new">
            <Button size="lg" variant="secondary" className="text-primary font-bold px-10 py-8 text-xl shadow-2xl">{cms.text("cta_button", t("home.ctaButton"))}</Button>
          </Link>
        </div>
      </section>
    </Layout>
  );
}



