"use client";

const heroBg = "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063929/ace-tours-assets/ace_tours_hero_beach.jpg";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CounterInput } from "@/components/ui/counter-input";
import { CalendarIcon, Users, Search, Map, Car } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";
import { useBookingDraft } from "@/lib/booking-state-context";

export function Hero() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [serviceType, setServiceType] = useState<string>("");
  const [guests, setGuests] = useState<string>("2");
  const [adultGuests, setAdultGuests] = useState<number>(2);
  const [childGuests, setChildGuests] = useState<number>(0);

  const { data: allTours = [] } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
  });

  // Deduplicate tours by normalized title
  const uniqueTours = useMemo(() => {
    return allTours.reduce<typeof allTours>((acc, current) => {
      // Skip test data with safety checks
      if (!current?.title) return acc;
      const titleLower = current.title.toLowerCase();
      if (titleLower.includes("verification") ||
        titleLower.includes("concurrent") ||
        titleLower.includes("test_tour") ||
        titleLower.includes("phase4")) {
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

  const tours = useMemo(() => uniqueTours.filter(t => t.category === "tour"), [uniqueTours]);
  const transfers = useMemo(() => uniqueTours.filter(t => t.category === "transfer"), [uniqueTours]);
  const vehicles = useMemo(() => uniqueTours.filter(t => t.category === "vehicle"), [uniqueTours]);

  const { updateDraft } = useBookingDraft();

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (selectedDate) params.set("date", format(selectedDate, "yyyy-MM-dd"));
    if (adultGuests) params.set("adults", adultGuests.toString());
    if (childGuests) params.set("children", childGuests.toString());
    params.set("guests", (adultGuests + childGuests).toString());

    // Persist to central booking state for prefilling detail pages
    updateDraft({
      date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
      adultPax: adultGuests,
      childPax: childGuests,
    });

    // Check for specific product selection first
    if (typeof serviceType === "string" && serviceType.startsWith("tour-")) {
      const tourId = serviceType.replace("tour-", "");
      setLocation(`/tours/${tourId}?${params.toString()}`);
      return;
    }

    if (typeof serviceType === "string" && serviceType.startsWith("transfer-")) {
      const transferId = serviceType.replace("transfer-", "");
      setLocation(`/transfers/${transferId}?${params.toString()}`);
      return;
    }

    if (typeof serviceType === "string" && serviceType.startsWith("vehicle-")) {
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
          transition={{ duration: 1, delay: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-6xl z-10"
        >
          <div className="relative p-1 rounded-[3rem] bg-gradient-to-b from-white/20 to-white/5 backdrop-blur-xl border border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] overflow-hidden group/container">
            {/* Ambient Background Glows */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#f2800d]/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="bg-white/95 rounded-[2.8rem] p-3 md:p-6 lg:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4 items-stretch relative z-10 text-gray-900">
              {/* Service Type Island */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex flex-col gap-2 p-4 rounded-3xl bg-gray-50/50 border border-gray-100/80 hover:bg-white hover:shadow-xl hover:border-gray-200/50 transition-all md:col-span-12 lg:col-span-4 group/island"
              >
                <label htmlFor="hero-service-select" className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 px-1 mb-1 cursor-pointer">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#f2800d]" />
                  {t("hero.serviceType", "Category")}
                </label>
                <div className="relative">
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger id="hero-service-select" className="h-14 border-0 bg-transparent text-lg font-bold text-gray-900 focus:ring-0 shadow-none px-0" data-testid="select-service-type">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-orange-50 flex items-center justify-center text-[#f2800d] shrink-0 group-hover/island:bg-[#f2800d] group-hover/island:text-white transition-all">
                          <Map className="h-5 w-5" />
                        </div>
                        <SelectValue placeholder={t("hero.selectService", "Tours & Transfers")} />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-3xl border-gray-100 shadow-2xl p-2">
                      <SelectItem value="all-tours" className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                        <div className="flex items-center gap-3">
                          <Map className="h-5 w-5 text-[#f2800d]" />
                          <span className="font-semibold text-base">{t("hero.allTours", "All Tours")}</span>
                        </div>
                      </SelectItem>
                      {tours.map((tour) => (
                        <SelectItem key={tour.id} value={`tour-${tour.id}`} className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground transition-all">
                          <span className="pl-8 text-base font-medium">{tour.title}</span>
                        </SelectItem>
                      ))}
                      <SelectSeparator className="my-2 bg-gray-100" />
                      <SelectItem value="all-transfers" className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                        <div className="flex items-center gap-3">
                          <Car className="h-5 w-5 text-[#f2800d]" />
                          <span className="font-semibold text-base">{t("hero.allTransfers", "All Transfers")}</span>
                        </div>
                      </SelectItem>
                      {transfers.map((transfer) => (
                        <SelectItem key={transfer.id} value={`transfer-${transfer.id}`} className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground transition-all">
                          <span className="pl-8 text-base font-medium">{transfer.title}</span>
                        </SelectItem>
                      ))}
                      {vehicles.length > 0 && (
                        <>
                          <SelectSeparator className="my-2 bg-gray-100" />
                          <SelectItem value="all-vehicles" className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                            <div className="flex items-center gap-3">
                              <Car className="h-5 w-5 text-[#f2800d]" />
                              <span className="font-semibold text-base">{t("hero.allVehicles", "Vehicle Hire")}</span>
                            </div>
                          </SelectItem>
                          {vehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={`vehicle-${vehicle.id}`} className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground transition-all">
                              <span className="pl-8 text-base font-medium">{vehicle.title}</span>
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>

              {/* Date Picker Island */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex flex-col gap-2 p-4 rounded-3xl bg-gray-50/50 border border-gray-100/80 hover:bg-white hover:shadow-xl hover:border-gray-200/50 transition-all md:col-span-6 lg:col-span-3 group/island"
              >
                <label htmlFor="hero-date-picker" className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 px-1 mb-1 cursor-pointer">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#f2800d]" />
                  {t("hero.travelDate", "Date")}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="hero-date-picker"
                      variant="outline"
                      className={cn(
                        "w-full h-14 justify-start text-left border-0 bg-transparent text-lg font-bold focus:ring-0 shadow-none px-0",
                        !selectedDate ? "text-gray-400 font-medium" : "text-gray-900"
                      )}
                      data-testid="button-date-picker"
                    >
                      <div className="h-10 w-10 rounded-2xl bg-orange-50 flex items-center justify-center text-[#f2800d] shrink-0 mr-3 group-hover/island:bg-[#f2800d] group-hover/island:text-white transition-all">
                        <CalendarIcon className="h-5 w-5" />
                      </div>
                      {selectedDate ? format(selectedDate, "EEE, MMM d") : t("hero.pickDate", "Pick a date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-3xl border-gray-100 shadow-2xl" align="start">
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
              </motion.div>

              {/* Guests Island - Adult/Child Split */}
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex flex-col gap-2 p-4 rounded-3xl bg-gray-50/50 border border-gray-100/80 hover:bg-white hover:shadow-xl hover:border-gray-200/50 transition-all md:col-span-6 lg:col-span-3 group/island"
              >
                <div className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 px-1 mb-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#f2800d]" />
                  {t("hero.guests", "Guests")}
                  {(adultGuests + childGuests) > 0 && (
                    <span className="ml-auto text-[#f2800d] font-black">
                      {adultGuests + childGuests} total
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {/* Adults row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <div className="h-7 w-7 rounded-xl bg-orange-50 flex items-center justify-center text-[#f2800d] group-hover/island:bg-[#f2800d] group-hover/island:text-white transition-all">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      Adults
                    </div>
                    <CounterInput
                      id="hero-adult-count"
                      name="adults"
                      value={adultGuests}
                      onValueChange={(val) => { setAdultGuests(val); setGuests((val + childGuests).toString()); }}
                      min={1}
                      max={50}
                      label="Adults"
                      className="h-9 bg-transparent border-0 hover:bg-transparent shadow-none px-0 w-32"
                      inputClassName="bg-transparent border-0 h-full text-sm font-bold text-gray-900 text-right"
                    />
                  </div>
                  {/* Children row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <div className="h-7 w-7 rounded-xl bg-blue-50 flex items-center justify-center text-blue-400 transition-all">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      <span>Children <span className="text-gray-400 font-normal text-xs">(under 12)</span></span>
                    </div>
                    <CounterInput
                      id="hero-child-count"
                      name="children"
                      value={childGuests}
                      onValueChange={(val) => { setChildGuests(val); setGuests((adultGuests + val).toString()); }}
                      min={0}
                      max={30}
                      label="Children"
                      className="h-9 bg-transparent border-0 hover:bg-transparent shadow-none px-0 w-32"
                      inputClassName="bg-transparent border-0 h-full text-sm font-bold text-gray-900 text-right"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Search Action */}
              <div className="md:col-span-12 lg:col-span-2 flex items-center lg:pl-2">
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSearch}
                  className="w-full h-16 lg:h-full min-h-[64px] rounded-3xl bg-[#f2800d] text-white font-black text-lg shadow-[0_12px_24px_-8px_rgba(242,128,13,0.5)] hover:shadow-[0_20px_40px_-12px_rgba(242,128,13,0.6)] hover:bg-[#ff8c1a] transition-all flex items-center justify-center gap-3 active:translate-y-1 relative overflow-hidden group/btn"
                >
                  <span className="relative z-10">{t("hero.checkAvailability", "Check")}</span>
                  <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center relative z-10">
                    <Search className="h-5 w-5" />
                  </div>
                </motion.button>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8 pt-6 border-t border-white/10">
            <span className="text-sm text-white/60 font-black uppercase tracking-widest">{t("hero.popularSearches", "Popular:")}</span>
            {[
              { label: t("nav.tours"), href: "/tours" },
              { label: t("hero.airportTransfer", "Airport Transfer"), href: "/transfers" },
              { label: t("hero.dayTours", "Day Tours"), href: "/tours" }
            ].map((link) => (
              <Link key={link.label} href={link.href}>
                <Button variant="secondary" size="sm" className="bg-white/10 hover:bg-[#f2800d] text-white font-bold rounded-full border border-white/10 hover:border-[#f2800d] transition-all backdrop-blur-md">
                  {link.label}
                </Button>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center p-1 backdrop-blur-sm">
            <motion.div
              className="w-1 h-2 bg-[#f2800d] rounded-full"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
