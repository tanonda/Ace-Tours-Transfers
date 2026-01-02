
import { Layout } from "@/components/layout";
import { Hero } from "@/components/hero";
import { TourCard } from "@/components/tour-card";
import { motion } from "framer-motion";
import aboutImg from "@assets/stock_images/vanuatu_rarru_waterf_a12f619f.jpg";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/booking-modal";
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";
import { useTranslation } from "react-i18next";

export default function Home() {
  const { t } = useTranslation();
  const { data: allTours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  // Deduplicate tours by normalized title to handle DB duplicates and naming variations
  const uniqueTours = allTours.reduce<typeof allTours>((acc, current) => {
    // Skip test data
    if (current.title.toLowerCase().includes("verification")) return acc;
    
    const normalize = (t: string) => t.replace(/\s+Package$/i, "").trim();
    const normalizedTitle = normalize(current.title);
    
    const existingIndex = acc.findIndex(item => normalize(item.title) === normalizedTitle);
    
    if (existingIndex === -1) {
      acc.push(current);
    }
    return acc;
  }, []);

  const toursList = uniqueTours.filter(t => t.category === "tour");
  const transfers = uniqueTours.filter(t => t.category === "transfer");
  const vehicles = uniqueTours.filter(t => t.category === "vehicle");

  return (
    <Layout>
      <Hero />

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
                  <p className="font-serif text-lg italic text-foreground">"{t("home.quote")}"</p>
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
                <span className="text-primary font-semibold uppercase tracking-wider text-sm">{t("home.aboutLabel")}</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">{t("home.aboutTitle")}</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                {t("home.aboutDesc1")}
              </p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                {t("home.aboutDesc2")}
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {[
                  t("home.fullyInsured"),
                  t("home.experiencedDrivers"),
                  t("home.customItineraries"),
                  t("home.safetyFirst")
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
            <span className="text-primary font-semibold uppercase tracking-wider text-sm mb-2 block">{t("home.toursLabel")}</span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">{t("home.toursTitle")}</h2>
            <p className="text-lg text-muted-foreground">{t("home.toursDesc")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {toursList.map((tour, index) => (
              <TourCard key={tour.id} tour={tour} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Transfers Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-primary font-semibold uppercase tracking-wider text-sm mb-2 block">{t("home.transfersLabel", "Airport & Hotel")}</span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">{t("home.transfersTitle")}</h2>
            <p className="text-lg text-muted-foreground">{t("home.transfersDesc")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {transfers.map((transfer, index) => (
              <TourCard key={transfer.id} tour={transfer} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Vehicle Hire Section */}
      {vehicles.length > 0 && (
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-primary font-semibold uppercase tracking-wider text-sm mb-2 block">{t("vehicles.label", "Self-Drive")}</span>
              <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">{t("vehicles.title", "Vehicle Hire")}</h2>
              <p className="text-lg text-muted-foreground">{t("vehicles.description", "Explore Vanuatu at your own pace with our reliable vehicle hire service.")}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {vehicles.slice(0, 3).map((vehicle, index) => (
                <TourCard key={vehicle.id} tour={vehicle} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="container mx-auto px-4 relative text-center text-white">
          <h2 className="text-4xl md:text-6xl font-bold mb-8 font-serif">{t("home.ctaTitle")}</h2>
          <p className="text-xl md:text-2xl mb-10 max-w-2xl mx-auto opacity-90">{t("home.ctaDesc")}</p>
          <BookingModal trigger={<Button size="lg" variant="secondary" className="text-primary font-bold px-10 py-8 text-xl shadow-2xl">{t("home.ctaButton")}</Button>} />
        </div>
      </section>
    </Layout>
  );
}
