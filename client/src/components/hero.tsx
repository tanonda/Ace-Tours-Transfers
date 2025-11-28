
import heroBg from "@assets/stock_images/vanuatu_tropical_bea_1818375e.jpg";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { BookingModal } from "@/components/booking-modal";
import { Link } from "wouter";

export function Hero() {
  return (
    <section className="relative h-screen min-h-[600px] w-full overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      </div>

      {/* Content */}
      <div className="relative h-full container mx-auto px-4 flex flex-col justify-center items-center text-center text-white pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl"
        >
          <span className="inline-block py-1 px-3 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-sm font-medium mb-6 tracking-wider uppercase">
            Welcome to Vanuatu
          </span>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight drop-shadow-xl">
            Time for your <br/>
            <span className="text-primary italic">next adventure</span>
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto font-light leading-relaxed">
            Let us help you with your travel plans. Explore the hidden gems of Efate Island with our curated tours.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <BookingModal trigger={<Button size="lg" className="text-lg px-8 py-6 h-auto shadow-xl hover:scale-105 transition-transform">Book Your Tour</Button>} />
            <Link href="/tours">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6 h-auto bg-white/10 border-white text-white hover:bg-white hover:text-foreground backdrop-blur-sm">
                View Packages
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div 
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/60"
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
