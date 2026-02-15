
const heroBg = "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063929/ace-tours-assets/ace_tours_hero_beach.jpg";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Users, Search, Map, Car } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";

export function Hero() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [serviceType, setServiceType] = useState<string>("");
  const [guests, setGuests] = useState<string>("2");

  const { data: allTours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  // Deduplicate tours by normalized title
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

  const tours = uniqueTours.filter(t => t.category === "tour");
  const transfers = uniqueTours.filter(t => t.category === "transfer");
  const vehicles = uniqueTours.filter(t => t.category === "vehicle");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (selectedDate) params.set("date", format(selectedDate, "yyyy-MM-dd"));
    if (guests) params.set("guests", guests);

    // Check for specific product selection first
    if (serviceType.startsWith("tour-")) {
      const tourId = serviceType.replace("tour-", "");
      setLocation(`/tours/${tourId}?${params.toString()}`);
      return;
    }

    if (serviceType.startsWith("transfer-")) {
      const transferId = serviceType.replace("transfer-", "");
      setLocation(`/transfers/${transferId}?${params.toString()}`);
      return;
    }

    if (serviceType.startsWith("vehicle-")) {
      const vehicleId = serviceType.replace("vehicle-", "");
      setLocation(`/vehicles/${vehicleId}?${params.toString()}`);
      return;
    }

    // Fallback to category pages
    if (serviceType) params.set("service", serviceType);

    const isTransfer = serviceType === "all-transfers";
    const isVehicle = serviceType === "all-vehicles";

    if (isVehicle) {
      setLocation(`/vehicles?${params.toString()}`);
    } else if (isTransfer) {
      setLocation(`/transfers?${params.toString()}`);
    } else {
      setLocation(`/tours?${params.toString()}`);
    }
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 backdrop-blur-[0.5px]" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 flex flex-col justify-center items-center text-center text-white pt-28 pb-20 md:pt-36 md:pb-24 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl"
        >
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl mb-6 leading-[1.1] drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
            <span className="text-white font-bold block md:inline">{t("hero.titlePart1")} </span>
            <span className="text-[#f2800d] italic font-normal lowercase">{t("hero.titlePart2")}</span>
          </h1>
          <p className="text-xl md:text-2xl text-white drop-shadow-md mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
            {t("home.toursDesc")}
          </p>
        </motion.div>

        {/* Availability Checker Widget */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="w-full max-w-5xl"
        >
          <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-5 md:p-8 border border-white/20 ring-1 ring-black/5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:items-end">
              {/* Service Type */}
              <div className="flex flex-col gap-2.5 md:col-span-4 transition-all">
                <label className="text-[0.8125rem] font-bold text-gray-800 flex items-center gap-2 px-1">
                  <Map className="h-4 w-4 text-[#f2800d]" />
                  {t("hero.serviceType", "What are you looking for?")}
                </label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger className="h-16 text-base bg-gray-50 border-gray-200 hover:border-[#f2800d]/50 focus:ring-[#f2800d]/20 shadow-inner rounded-2xl transition-all" data-testid="select-service-type">
                    <SelectValue placeholder={t("hero.selectService", "Tours & Transfers")} className="text-gray-900 font-medium" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-gray-200">
                    <SelectItem value="all-tours" className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                      <div className="flex items-center gap-3">
                        <Map className="h-5 w-5 text-[#f2800d]" />
                        <span className="font-semibold">{t("hero.allTours", "All Tours")}</span>
                      </div>
                    </SelectItem>
                    {tours.slice(0, 4).map((tour) => (
                      <SelectItem key={tour.id} value={`tour-${tour.id}`} className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                        <span className="pl-8">{tour.title}</span>
                      </SelectItem>
                    ))}
                    <div className="h-px bg-gray-100 my-1" />
                    <SelectItem value="all-transfers" className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                      <div className="flex items-center gap-3">
                        <Car className="h-5 w-5 text-[#f2800d]" />
                        <span className="font-semibold">{t("hero.allTransfers", "All Transfers")}</span>
                      </div>
                    </SelectItem>
                    {transfers.slice(0, 3).map((transfer) => (
                      <SelectItem key={transfer.id} value={`transfer-${transfer.id}`} className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                        <span className="pl-8">{transfer.title}</span>
                      </SelectItem>
                    ))}
                    {vehicles.length > 0 && (
                      <>
                        <div className="h-px bg-gray-100 my-1" />
                        <SelectItem value="all-vehicles" className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                          <div className="flex items-center gap-3">
                            <Car className="h-5 w-5 text-[#f2800d]" />
                            <span className="font-semibold">{t("hero.allVehicles", "Vehicle Hire")}</span>
                          </div>
                        </SelectItem>
                        {vehicles.slice(0, 3).map((vehicle) => (
                          <SelectItem key={vehicle.id} value={`vehicle-${vehicle.id}`} className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                            <span className="pl-8">{vehicle.title}</span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Picker */}
              <div className="flex flex-col gap-2.5 md:col-span-3 transition-all">
                <label className="text-[0.8125rem] font-bold text-gray-800 flex items-center gap-2 px-1">
                  <CalendarIcon className="h-4 w-4 text-[#f2800d]" />
                  {t("hero.travelDate", "When?")}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-16 justify-start text-left text-base font-medium bg-gray-50 border-gray-200 hover:border-[#f2800d]/50 shadow-inner rounded-2xl transition-all",
                        !selectedDate && "text-gray-400"
                      )}
                      data-testid="button-date-picker"
                    >
                      <CalendarIcon className="mr-3 h-5 w-5 text-[#f2800d]/60" />
                      {selectedDate ? format(selectedDate, "EEE, MMM d, yyyy") : t("hero.pickDate", "Pick a date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-gray-200" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="touch-calendar"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Guests */}
              <div className="flex flex-col gap-2.5 md:col-span-2 transition-all">
                <label className="text-[0.8125rem] font-bold text-gray-800 flex items-center gap-2 px-1">
                  <Users className="h-4 w-4 text-[#f2800d]" />
                  {t("hero.guests", "How many?")}
                </label>
                <div className="relative group">
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    className="h-16 text-base px-5 bg-gray-50 border-gray-200 hover:border-[#f2800d]/50 focus:ring-[#f2800d]/20 shadow-inner rounded-2xl text-foreground font-medium"
                    placeholder={t("hero.guestsPlaceholder", "2 guests")}
                    data-testid="input-guests"
                  />
                  <Users className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-hover:text-[#f2800d]/60 transition-colors" />
                </div>
              </div>

              {/* Search Button */}
              <div className="md:col-span-3 transition-all">
                <Button
                  onClick={handleSearch}
                  size="lg"
                  className="w-full h-16 text-lg font-bold bg-[#f2800d] hover:bg-[#d9730b] text-white shadow-[0_10px_20px_rgba(242,128,13,0.3)] hover:shadow-[0_15px_30px_rgba(242,128,13,0.4)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 rounded-2xl"
                  data-testid="button-check-availability"
                >
                  <Search className="mr-2 h-6 w-6 stroke-[2.5]" />
                  {t("hero.checkAvailability", "Check Availability")}
                </Button>
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6 pt-6 border-t border-gray-100">
              <span className="text-sm text-gray-500 font-bold uppercase tracking-wider">{t("hero.popularSearches", "Popular:")}</span>
              {[
                { label: t("nav.tours"), href: "/tours" },
                { label: t("hero.airportTransfer", "Airport Transfer"), href: "/transfers" },
                { label: t("hero.dayTours", "Day Tours"), href: "/tours" }
              ].map((link) => (
                <Link key={link.label} href={link.href}>
                  <Button variant="secondary" size="sm" className="bg-gray-100 hover:bg-[#f2800d]/10 text-gray-700 hover:text-[#f2800d] font-bold rounded-full border border-transparent hover:border-[#f2800d]/20 transition-all">
                    {link.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/80"
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-7 h-12 border-2 border-white/40 rounded-full flex justify-center p-1.5 backdrop-blur-sm">
          <motion.div
            className="w-1.5 h-2.5 bg-[#f2800d] rounded-full"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      </motion.div>
    </section>
  );
}
