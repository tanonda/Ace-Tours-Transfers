
import heroBg from "@assets/stock_images/vanuatu_tropical_bea_1818375e.jpg";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { BookingWidget } from "@/components/booking-widget";

export function Hero() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden flex items-center">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />
        {/* Gradient overlay for better text visibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative w-full container mx-auto px-4 pt-24 pb-12 md:py-0">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20">
          
          {/* Text Content - Left Side */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-2xl text-left text-white"
          >
            <span className="inline-block py-1 px-3 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-sm font-medium mb-6 tracking-wider uppercase">
              Welcome to Vanuatu
            </span>
            <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 leading-tight drop-shadow-xl">
              GO with us <br/>
              <span className="text-primary italic">from anywhere,</span><br/>
              to anywhere.
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-8 max-w-lg font-light leading-relaxed">
              Reserve in advance. Ride without worry. Explore the hidden gems of Efate Island with our curated tours and reliable transfers.
            </p>
            
            <div className="hidden lg:block">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6 h-auto bg-white/10 border-white text-white hover:bg-white hover:text-foreground backdrop-blur-sm rounded-full">
                View All Packages
              </Button>
            </div>
          </motion.div>

          {/* Booking Widget - Right Side */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="w-full max-w-md lg:mr-auto"
          >
            <BookingWidget />
          </motion.div>

        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div 
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 hidden lg:block"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center p-1">
          <div className="w-1 h-2 bg-white rounded-full" />
        </div>
      </motion.div>
    </section>
  );
}
