
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Check } from "lucide-react";
import { BookingModal } from "@/components/booking-modal";
import { motion } from "framer-motion";

interface TourProps {
  id: string;
  title: string;
  price: string;
  duration: string;
  minPax?: string;
  description: string[];
  image: string;
}

export function TourCard({ tour, index }: { tour: TourProps; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
    >
      <Card className="h-full flex flex-col overflow-hidden border-none shadow-lg hover:shadow-xl transition-shadow duration-300 group">
        <div className="relative h-64 overflow-hidden">
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors z-10" />
          <img 
            src={tour.image} 
            alt={tour.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute top-4 right-4 z-20">
            <Badge className="bg-white/90 text-foreground hover:bg-white text-sm font-bold px-3 py-1 shadow-sm backdrop-blur-sm">
              {tour.price}
            </Badge>
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
            {tour.description.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        
        <CardFooter className="pt-4 border-t border-border/50 bg-muted/30">
          <BookingModal 
            preselectedService={tour.title}
            trigger={<Button className="w-full font-semibold" size="lg">Book Now</Button>} 
          />
        </CardFooter>
      </Card>
    </motion.div>
  );
}
