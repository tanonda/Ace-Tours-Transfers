
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchVehicle } from "@/lib/api";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Check, Star, ShoppingCart, ArrowLeft, Calendar, Car, Fuel, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useCart } from "@/lib/cart-context";
import { useBookingDraft, usePrefillFromCart } from "@/lib/booking-state-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { BookingModal } from "@/components/booking-modal";
import { formatPriceDisplay } from "@/lib/product.types";
import { useCurrency } from "@/lib/currency-context";
import { AvailabilityStatus, AvailabilityCalendar } from "@/components";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface VehicleDetails {
  make: string;
  model: string;
  seats: number;
  transmission: string;
  features: string[];
}

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { addToCart } = useCart();
  const { updateDraft } = useBookingDraft();
  const { currency } = useCurrency();

  // Vehicle uses days instead of pax, get prefill for date
  const prefill = usePrefillFromCart(id || "");
  const [days, setDays] = useState("1");
  const [date, setDate] = useState(prefill.date);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Sync local state changes to booking draft context
  useEffect(() => {
    if (id) {
      updateDraft({
        productId: id,
        adultPax: 1,
        childPax: 0,
        date,
      });
    }
  }, [id, date, updateDraft]);

  const { data: vehicle, isLoading, error } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: () => fetchVehicle(id!),
    enabled: !!id,
  });

  const handleDateSelect = useCallback((d: string) => {
    setDate(d);
    setSelectedTime(null);
  }, []);

  const handleTimeSelect = useCallback((t: string) => {
    setSelectedTime(t);
  }, []);

  const handleAddToCart = () => {
    if (!vehicle) return;
    addToCart({
      id: vehicle.id,
      title: vehicle.title,
      price: vehicle.adultPriceCents,
      childPrice: 0, // Vehicles don't have child pricing
      image: vehicle.image,
      type: "vehicle",
      adultPax: 1,
      childPax: 0,
      quantity: parseInt(days),
      date: date ? new Date(date) : new Date(),
      startTime: selectedTime || undefined,
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh] pt-32">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  if (error || !vehicle) {
    return (
      <Layout>
        <div className="container mx-auto px-4 pt-40 pb-20 text-center">
          <h1 className="text-4xl font-bold mb-4">{t("common.error", "Error")}</h1>
          <p className="text-muted-foreground mb-8">{t("vehicles.notFound", "Vehicle not found")}</p>
          <Button onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.goBack", "Go Back")}
          </Button>
        </div>
      </Layout>
    );
  }

  const vehicleDetails = vehicle.vehicleDetails as VehicleDetails | undefined;


  return (
    <Layout>
      <div className="pt-40 pb-20 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              variant="ghost"
              className="mb-8 hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.back", "Back")}
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Image Section */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl h-[400px] md:h-[600px]">
                <img
                  src={vehicle.image}
                  alt={vehicle.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-6 left-6 flex gap-3">
                  <Badge className="bg-primary text-white text-lg px-4 py-2 shadow-xl">
                    {formatPriceDisplay(vehicle.adultPriceCents, currency)} / day
                  </Badge>
                </div>
              </div>

              {/* Info Section */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex text-yellow-400">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="h-5 w-5 fill-current" />
                    ))}
                  </div>
                  <span className="text-muted-foreground font-medium">({t("quickView.reviews", "8 reviews")})</span>
                  <Badge variant="secondary" className="ml-2 uppercase tracking-wider">
                    <Car className="h-3 w-3 mr-1" /> Vehicle Hire
                  </Badge>
                </div>

                <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-foreground">{vehicle.title}</h1>

                {/* Vehicle Specs */}
                {vehicleDetails && (
                  <div className="flex flex-wrap items-center gap-4 mb-8 text-muted-foreground">
                    <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full border border-border/50">
                      <Car className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{vehicleDetails.make} {vehicleDetails.model}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full border border-border/50">
                      <Users className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{vehicleDetails.seats} {t('vehicles.seats')}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-full border border-border/50">
                      <Settings className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{vehicleDetails.transmission}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-8 mb-10">
                  <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm transition-all hover:shadow-md">
                    <h3 className="text-xl font-bold mb-4 font-serif text-primary">{t("quickView.overview", "Vehicle Overview")}</h3>
                    <p className="text-muted-foreground leading-relaxed text-lg italic">
                      {vehicle.description[0]}
                    </p>
                  </div>

                  {/* Features */}
                  {vehicleDetails?.features && (
                    <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm transition-all hover:shadow-md">
                      <h3 className="text-xl font-bold mb-4 font-serif text-primary">{t("vehicles.features", "Vehicle Features")}</h3>
                      <div className="flex flex-wrap gap-2">
                        {vehicleDetails.features.map((feature, i) => (
                          <Badge key={i} variant="outline" className="px-3 py-1.5 text-sm">
                            <Check className="h-3 w-3 mr-1" /> {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* What's Included */}
                  {Array.isArray(vehicle.description) && vehicle.description.length > 1 && (
                    <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm transition-all hover:shadow-md">
                      <h3 className="text-xl font-bold mb-4 font-serif text-primary">{t("quickView.whatsIncluded", "What's Included")}</h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {vehicle.description.slice(1).map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-muted-foreground">
                            <div className="mt-1 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Check className="h-3 w-3 text-primary" />
                            </div>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Rates Section */}
                  <div className="bg-muted/30 p-6 rounded-2xl border border-border/50">
                    <h3 className="text-xl font-bold mb-4 font-serif text-primary">{t("quickView.ratesOptions", "Rates")}</h3>
                    <div className="flex justify-between items-center text-lg mb-2">
                      <span>{t("vehicles.perDay", "Per Day")}</span>
                      <span className="font-bold text-foreground">{formatPriceDisplay(vehicle.adultPriceCents, currency)} / day</span>
                    </div>
                  </div>
                </div>

                {/* Booking Card */}
                <div className="mt-auto bg-primary/5 p-8 rounded-3xl border-2 border-primary/20 shadow-inner">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                      <Label htmlFor="detail-days" className="text-sm font-bold ml-1">{t("vehicles.rentalDays", "Rental Days")}</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="detail-days"
                          type="number"
                          min="1"
                          value={days}
                          onChange={(e) => setDays(e.target.value)}
                          className="pl-10 h-12 bg-background border-primary/20 focus:border-primary"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="detail-date" className="text-sm font-bold ml-1">{t("itinerary.bookingInfo", "Pickup Date")}</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <div className="relative">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={`w-full pl-10 h-12 bg-background border-primary/20 focus:border-primary text-left font-normal ${!date && "text-muted-foreground"}`}
                              >
                                <span className="flex flex-col items-start leading-none gap-1">
                                  <span>{date ? new Date(date).toDateString() : "Pick a date"}</span>
                                  {selectedTime && <span className="text-xs text-primary font-bold">@ {selectedTime}</span>}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <AvailabilityCalendar
                                tourId={vehicle.id}
                                participants={1}
                                onDateSelect={handleDateSelect}
                                onTimeSelect={handleTimeSelect}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Phase 3: Availability & Pricing Widgets for Vehicles */}
                  {vehicle.id && date && (
                    <div className="space-y-6 mb-10">
                      {/* Real-time Availability Status */}
                      <div className="bg-card p-6 rounded-2xl border border-border/50 shadow-sm">
                        <h3 className="text-xl font-bold mb-4 font-serif text-primary">Vehicle Availability</h3>
                        <AvailabilityStatus
                          tourId={vehicle.id}
                          selectedDate={new Date(date)}
                          maxParticipants={vehicleDetails?.seats || 6}
                          adultPax={1}
                          childPax={0}
                          onAvailabilityChange={(available) => {
                            console.log("Vehicle availability status:", available);
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      className="flex-1 h-16 text-xl font-bold shadow-lg shadow-primary/20"
                      onClick={handleAddToCart}
                    >
                      <ShoppingCart className="mr-2 h-6 w-6" />
                      {t("cart.addToCart", "Add to Cart")}
                    </Button>
                    <BookingModal
                      preselectedService={vehicle.title}
                      initialDate={date ? new Date(date) : undefined}
                      trigger={
                        <Button variant="secondary" className="flex-1 h-16 text-xl font-bold bg-white border-2 border-primary text-primary hover:bg-primary/5 transition-all">
                          {t("vehicles.bookNow", "Hire Now")}
                        </Button>
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
