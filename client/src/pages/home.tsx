
import { Layout } from "@/components/layout";
import { Hero } from "@/components/hero";
import { TourCard } from "@/components/tour-card";
import { motion } from "framer-motion";
import aboutImg from "@assets/stock_images/vanuatu_rarru_waterf_a12f619f.jpg";
import { CheckCircle, MapPin, Shield, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingModal } from "@/components/booking-modal";
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";

export default function Home() {
  const { data: tours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  const toursList = tours.filter(t => t.category === "tour");
  const transfers = tours.filter(t => t.category === "transfer");

  return (
    <Layout>
      <Hero />

      {/* About Section */}
      <section className="py-20 bg-[#FFFDF5] overflow-hidden">
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
                <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-xl shadow-xl max-w-xs hidden md:block">
                  <p className="font-serif text-lg italic text-foreground">"Customer satisfaction, safety, and service are at the heart of everything we do."</p>
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
                <span className="text-primary font-semibold uppercase tracking-wider text-sm">About Us</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Travel made easy</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Welcome to Ace Tours & Transfers. Our mission is to offer meticulously pre-planned and custom-designed tour packages that ensure your stay in Port Vila is nothing short of extraordinary.
              </p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Whether you're seeking adventure, relaxation, or cultural immersion, we are dedicated to making your experience enjoyable, safe, and unforgettable. We are fully insured for public liability and take your safety to heart!
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {[
                  "Fully Insured",
                  "Experienced Drivers",
                  "Custom Itineraries",
                  "Safety First"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle className="text-primary h-5 w-5" />
                    <span className="font-medium">{item}</span>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white">Learn More About Us</Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Tours Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-primary font-semibold uppercase tracking-wider text-sm mb-2 block">Our Packages</span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Unforgettable Tours</h2>
            <p className="text-lg text-muted-foreground">Discover the best of Efate Island with our curated experiences.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {toursList.map((tour, index) => (
              <TourCard key={tour.id} tour={tour} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Transfers Section */}
      <section className="py-24 bg-[#291B12] text-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Reliable Transfers</h2>
            <p className="text-white/70 text-lg">Professional transport solutions for any occasion.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {transfers.map((transfer, i) => (
              <motion.div 
                key={transfer.id}
                className="bg-white/5 border border-white/10 rounded-xl p-8 hover:bg-white/10 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mb-6 text-primary">
                  {i === 0 ? <MapPin className="h-6 w-6" /> : i === 1 ? <Star className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
                </div>
                <h3 className="text-xl font-bold mb-2 font-serif">{transfer.title}</h3>
                <p className="text-primary font-medium mb-4">{transfer.price}</p>
                <p className="text-white/70 mb-6 text-sm leading-relaxed">{transfer.description.join(", ")}</p>
                <BookingModal 
                  preselectedService={transfer.title}
                  trigger={<Button variant="link" className="text-white p-0 h-auto hover:text-primary">Book Transfer &rarr;</Button>}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="container mx-auto px-4 relative text-center text-white">
          <h2 className="text-4xl md:text-6xl font-bold mb-8 font-serif">Ready for your next adventure?</h2>
          <p className="text-xl md:text-2xl mb-10 max-w-2xl mx-auto opacity-90">Let us handle the details while you make the memories.</p>
          <BookingModal trigger={<Button size="lg" variant="secondary" className="text-primary font-bold px-10 py-8 text-xl shadow-2xl">Start Planning Now</Button>} />
        </div>
      </section>
    </Layout>
  );
}
