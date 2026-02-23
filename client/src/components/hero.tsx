"use client";

const heroBg = "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063929/ace-tours-assets/ace_tours_hero_beach.jpg";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CounterInput } from "@/components/ui/counter-input";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Users, Search, Map, Car, ArrowRight, Truck } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";
import { useBookingDraft } from "@/lib/booking-state-context";

type ProductCategory = "tour" | "transfer" | "vehicle" | null;

function getCategoryFromServiceType(serviceType: string): ProductCategory {
  if (!serviceType) return null;
  if (serviceType === "all-tours" || serviceType.startsWith("tour-")) return "tour";
  if (serviceType === "all-transfers" || serviceType.startsWith("transfer-")) return "transfer";
  if (serviceType === "all-vehicles" || serviceType.startsWith("vehicle-")) return "vehicle";
  return null;
}

function CategoryIcon({ cat, className }: { cat: ProductCategory; className?: string }) {
  if (cat === "transfer") return <Car className={className} />;
  if (cat === "vehicle") return <Truck className={className} />;
  return <Map className={className} />;
}

function Island({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`flex flex-col gap-2 p-4 rounded-3xl bg-gray-50/50 border border-gray-100/80 hover:bg-white hover:shadow-xl hover:border-gray-200/50 transition-all group/island ${className}`}
    >
      {children}
    </motion.div>
  );
}

function IslandLabel({ label }: { label: string }) {
  return (
    <div className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 px-1 mb-1">
      <div className="h-1.5 w-1.5 rounded-full bg-[#f2800d]" />
      {label}
    </div>
  );
}

function IslandIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-10 w-10 rounded-2xl bg-orange-50 flex items-center justify-center text-[#f2800d] shrink-0 group-hover/island:bg-[#f2800d] group-hover/island:text-white transition-all">
      {children}
    </div>
  );
}

export function Hero() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [serviceType, setServiceType] = useState<string>("");

  // Tour fields
  const [tourDate, setTourDate] = useState<Date | undefined>(undefined);
  const [adultGuests, setAdultGuests] = useState<number>(2);
  const [childGuests, setChildGuests] = useState<number>(0);

  // Transfer fields
  const [transferDate, setTransferDate] = useState<Date | undefined>(undefined);
  const [fromLocation, setFromLocation] = useState<string>("");
  const [toLocation, setToLocation] = useState<string>("");
  const [transferPassengers, setTransferPassengers] = useState<number>(2);

  // Vehicle fields
  const [pickupDate, setPickupDate] = useState<Date | undefined>(undefined);
  const [returnDate, setReturnDate] = useState<Date | undefined>(undefined);

  const { data: allTours = [] } = useQuery({ queryKey: ["tours"], queryFn: fetchTours });

  // Filter out only test/seed data — never deduplicate real products by title,
  // as multiple distinct products can share similar names (e.g. different transfer routes).
  const cleanProducts = useMemo(() => {
    return allTours.filter(t => {
      if (!t?.title) return false;
      if (t.isActive === false) return false;
      const tl = t.title.toLowerCase();
      return !tl.includes("verification") && !tl.includes("concurrent") &&
        !tl.includes("test_tour") && !tl.includes("phase4");
    });
  }, [allTours]);

  const tours = useMemo(() => cleanProducts.filter(t => t.category === "tour"), [cleanProducts]);
  const transfers = useMemo(() => cleanProducts.filter(t => t.category === "transfer"), [cleanProducts]);
  const vehicles = useMemo(() => cleanProducts.filter(t => t.category === "vehicle"), [cleanProducts]);

  const { updateDraft } = useBookingDraft();
  const category = getCategoryFromServiceType(serviceType);

  const DatePickerIsland = ({
    label, value, onChange, minDate, colSpan = "md:col-span-6 lg:col-span-3", placeholder = "Pick a date",
  }: {
    label: string; value: Date | undefined; onChange: (d: Date | undefined) => void;
    minDate?: Date; colSpan?: string; placeholder?: string;
  }) => (
    <Island className={colSpan}>
      <IslandLabel label={label} />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full h-14 justify-start text-left border-0 bg-transparent text-lg font-black focus:ring-0 shadow-none px-0",
              !value ? "text-gray-400 font-medium" : "text-gray-900")}
          >
            <IslandIcon><CalendarIcon className="h-5 w-5" /></IslandIcon>
            <span className="ml-3">{value ? format(value, "EEE, MMM d") : placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-3xl border-gray-100 shadow-2xl" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange}
            disabled={(d) => d < (minDate || new Date())} initialFocus className="touch-calendar" />
        </PopoverContent>
      </Popover>
    </Island>
  );

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (category === "tour") {
      if (tourDate) params.set("date", format(tourDate, "yyyy-MM-dd"));
      params.set("adults", adultGuests.toString());
      params.set("children", childGuests.toString());
      params.set("guests", (adultGuests + childGuests).toString());
      updateDraft({ date: tourDate ? format(tourDate, "yyyy-MM-dd") : "", adultPax: adultGuests, childPax: childGuests });
    } else if (category === "transfer") {
      if (transferDate) params.set("date", format(transferDate, "yyyy-MM-dd"));
      params.set("adults", transferPassengers.toString());
      params.set("guests", transferPassengers.toString());
      if (fromLocation) params.set("from", fromLocation);
      if (toLocation) params.set("to", toLocation);
      updateDraft({ date: transferDate ? format(transferDate, "yyyy-MM-dd") : "", adultPax: transferPassengers, childPax: 0 });
    } else if (category === "vehicle") {
      if (pickupDate) params.set("pickup", format(pickupDate, "yyyy-MM-dd"));
      if (returnDate) params.set("return", format(returnDate, "yyyy-MM-dd"));
      if (pickupDate) params.set("date", format(pickupDate, "yyyy-MM-dd"));
      const hireDays = pickupDate && returnDate
        ? Math.max(1, Math.round((returnDate.getTime() - pickupDate.getTime()) / 86400000))
        : 1;
      params.set("days", hireDays.toString());
      updateDraft({ date: pickupDate ? format(pickupDate, "yyyy-MM-dd") : "", adultPax: hireDays, childPax: 0 });
    } else {
      setLocation("/tours");
      return;
    }
    if (serviceType.startsWith("tour-")) { setLocation(`/tours/${serviceType.replace("tour-", "")}?${params}`); return; }
    if (serviceType.startsWith("transfer-")) { setLocation(`/transfers/${serviceType.replace("transfer-", "")}?${params}`); return; }
    if (serviceType.startsWith("vehicle-")) { setLocation(`/vehicles/${serviceType.replace("vehicle-", "")}?${params}`); return; }
    if (category === "vehicle") { setLocation(`/vehicles?${params}`); return; }
    if (category === "transfer") { setLocation(`/transfers?${params}`); return; }
    setLocation(`/tours?${params}`);
  };

  const renderDynamicFields = () => {
    if (!category) {
      return (
        <motion.div key="prompt" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
          className="md:col-span-12 lg:col-span-8 flex items-center justify-center gap-3 p-4 rounded-3xl border border-dashed border-gray-200 text-gray-400 text-sm font-medium">
          <ArrowRight className="h-4 w-4 text-[#f2800d]" />
          Select a tour, transfer, or vehicle above to see availability options
        </motion.div>
      );
    }

    if (category === "tour") {
      return (
        <>
          <DatePickerIsland label={t("hero.travelDate", "Tour Date")} value={tourDate} onChange={setTourDate} colSpan="md:col-span-6 lg:col-span-3" />
          <Island className="md:col-span-6 lg:col-span-3">
            <IslandLabel label={t("hero.guests", "Guests")} />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <div className="h-7 w-7 rounded-xl bg-orange-50 flex items-center justify-center text-[#f2800d] group-hover/island:bg-[#f2800d] group-hover/island:text-white transition-all">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  Adults
                </div>
                <CounterInput id="hero-adult-count" name="adults" value={adultGuests} onValueChange={setAdultGuests}
                  min={1} max={50} label="Adults" className="h-9 bg-transparent border-0 hover:bg-transparent shadow-none px-0 w-32"
                  inputClassName="bg-transparent border-0 h-full text-sm font-bold text-gray-900 text-right" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <div className="h-7 w-7 rounded-xl bg-blue-50 flex items-center justify-center text-blue-400">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <span>Children <span className="text-gray-400 font-normal text-xs">(under 12)</span></span>
                </div>
                <CounterInput id="hero-child-count" name="children" value={childGuests} onValueChange={setChildGuests}
                  min={0} max={30} label="Children" className="h-9 bg-transparent border-0 hover:bg-transparent shadow-none px-0 w-32"
                  inputClassName="bg-transparent border-0 h-full text-sm font-bold text-gray-900 text-right" />
              </div>
            </div>
          </Island>
        </>
      );
    }

    if (category === "transfer") {
      return (
        <>
          <Island className="md:col-span-6 lg:col-span-2">
            <IslandLabel label="From" />
            <div className="flex items-center gap-3 h-14">
              <IslandIcon><Map className="h-5 w-5" /></IslandIcon>
              <Input value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} placeholder="Pickup point"
                className="border-0 bg-transparent shadow-none p-0 h-auto text-base font-bold placeholder:text-gray-400 focus-visible:ring-0" />
            </div>
          </Island>
          <Island className="md:col-span-6 lg:col-span-2">
            <IslandLabel label="To" />
            <div className="flex items-center gap-3 h-14">
              <IslandIcon><ArrowRight className="h-5 w-5" /></IslandIcon>
              <Input value={toLocation} onChange={(e) => setToLocation(e.target.value)} placeholder="Drop-off point"
                className="border-0 bg-transparent shadow-none p-0 h-auto text-base font-bold placeholder:text-gray-400 focus-visible:ring-0" />
            </div>
          </Island>
          <DatePickerIsland label="Transfer Date" value={transferDate} onChange={setTransferDate} colSpan="md:col-span-6 lg:col-span-2" />
          <Island className="md:col-span-6 lg:col-span-2">
            <IslandLabel label="Passengers" />
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                <IslandIcon><Users className="h-5 w-5" /></IslandIcon>
                <span className="text-sm font-semibold text-gray-700">Passengers</span>
              </div>
              <CounterInput id="transfer-pax" name="passengers" value={transferPassengers} onValueChange={setTransferPassengers}
                min={1} max={50} label="Passengers" className="h-9 bg-transparent border-0 hover:bg-transparent shadow-none px-0 w-32"
                inputClassName="bg-transparent border-0 h-full text-sm font-bold text-gray-900 text-right" />
            </div>
          </Island>
        </>
      );
    }

    if (category === "vehicle") {
      return (
        <>
          <DatePickerIsland label="Pickup Date" value={pickupDate}
            onChange={(d) => { setPickupDate(d); if (d && returnDate && returnDate <= d) setReturnDate(addDays(d, 1)); }}
            colSpan="md:col-span-6 lg:col-span-3" placeholder="Select pickup" />
          <DatePickerIsland label="Return Date" value={returnDate} onChange={setReturnDate}
            minDate={pickupDate ? addDays(pickupDate, 1) : new Date()}
            colSpan="md:col-span-6 lg:col-span-3" placeholder="Select return" />
          {pickupDate && returnDate && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="md:col-span-12 lg:col-span-2 flex items-center justify-center">
              <div className="text-center bg-orange-50 rounded-2xl px-6 py-3 border border-orange-100 w-full lg:w-auto">
                <div className="text-2xl font-black text-[#f2800d]">
                  {Math.round((returnDate.getTime() - pickupDate.getTime()) / 86400000)}
                </div>
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  {Math.round((returnDate.getTime() - pickupDate.getTime()) / 86400000) === 1 ? "Day" : "Days"} Hire
                </div>
              </div>
            </motion.div>
          )}
        </>
      );
    }
    return null;
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105"
        style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 backdrop-blur-[0.5px]" />
      </div>

      <div className="relative container mx-auto px-4 flex flex-col justify-center items-center text-center text-white pt-28 pb-20 md:pt-36 md:pb-24 min-h-screen">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="max-w-4xl">
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl mb-6 leading-[1.1] drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
            <span className="text-white font-bold block md:inline">{t("hero.titlePart1")} </span>
            <span className="text-[#f2800d] italic font-normal lowercase">{t("hero.titlePart2")}</span>
          </h1>
          <p className="text-xl md:text-2xl text-white drop-shadow-md mb-10 max-w-2xl mx-auto font-medium leading-relaxed">{t("home.toursDesc")}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.23, 1, 0.32, 1] }} className="w-full max-w-6xl z-10">
          <div className="relative p-1 rounded-[3rem] bg-gradient-to-b from-white/20 to-white/5 backdrop-blur-xl border border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#f2800d]/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="bg-white/95 rounded-[2.8rem] p-3 md:p-6 lg:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 lg:gap-4 items-stretch relative z-10 text-gray-900">

              {/* Product selector */}
              <Island className="md:col-span-12 lg:col-span-4">
                <IslandLabel label={t("hero.serviceType", "What are you looking for?")} />
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger id="hero-service-select" className="h-14 border-0 bg-transparent text-lg font-black text-gray-900 focus:ring-0 shadow-none px-0" data-testid="select-service-type">
                    <div className="flex items-center gap-3">
                      <IslandIcon><CategoryIcon cat={category} className="h-5 w-5" /></IslandIcon>
                      <SelectValue placeholder={t("hero.selectService", "Tours, Transfers, Vehicles…")} />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-3xl border-gray-100 shadow-2xl p-2">
                    <SelectItem value="all-tours" className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                      <div className="flex items-center gap-3"><Map className="h-5 w-5 text-[#f2800d]" /><span className="font-semibold text-base">{t("hero.allTours", "All Tours")}</span></div>
                    </SelectItem>
                    {tours.map(tour => (
                      <SelectItem key={tour.id} value={`tour-${tour.id}`} className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                        <span className="pl-8 text-base font-medium">{tour.title}</span>
                      </SelectItem>
                    ))}
                    <SelectSeparator className="my-2 bg-gray-100" />
                    <SelectItem value="all-transfers" className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                      <div className="flex items-center gap-3"><Car className="h-5 w-5 text-[#f2800d]" /><span className="font-semibold text-base">{t("hero.allTransfers", "All Transfers")}</span></div>
                    </SelectItem>
                    {transfers.map(tr => (
                      <SelectItem key={tr.id} value={`transfer-${tr.id}`} className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                        <span className="pl-8 text-base font-medium">{tr.title}</span>
                      </SelectItem>
                    ))}
                    {vehicles.length > 0 && (
                      <>
                        <SelectSeparator className="my-2 bg-gray-100" />
                        <SelectItem value="all-vehicles" className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                          <div className="flex items-center gap-3"><Truck className="h-5 w-5 text-[#f2800d]" /><span className="font-semibold text-base">{t("hero.allVehicles", "Vehicle Hire")}</span></div>
                        </SelectItem>
                        {vehicles.map(v => (
                          <SelectItem key={v.id} value={`vehicle-${v.id}`} className="py-3 focus:bg-orange-50 focus:text-orange-950 text-foreground">
                            <span className="pl-8 text-base font-medium">{v.title}</span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <AnimatePresence>
                  {category && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className={cn("text-xs font-bold px-3 py-1 rounded-full inline-flex items-center gap-1.5 mt-1",
                        category === "tour" && "bg-orange-50 text-orange-600",
                        category === "transfer" && "bg-blue-50 text-blue-600",
                        category === "vehicle" && "bg-green-50 text-green-700")}>
                        <CategoryIcon cat={category} className="h-3 w-3" />
                        {category === "tour" && "Tour — select date & guests"}
                        {category === "transfer" && "Transfer — enter route, date & passengers"}
                        {category === "vehicle" && "Vehicle Hire — pickup & return dates"}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Island>

              {/* Dynamic fields */}
              <AnimatePresence mode="wait">
                <motion.div key={category || "none"} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="contents">
                  {renderDynamicFields()}
                </motion.div>
              </AnimatePresence>

              {/* Search button */}
              <div className="md:col-span-12 lg:col-span-2 flex items-center lg:pl-2">
                <motion.button whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} onClick={handleSearch}
                  className="w-full h-16 lg:h-full min-h-[64px] rounded-3xl bg-[#f2800d] text-white font-black text-lg shadow-[0_12px_24px_-8px_rgba(242,128,13,0.5)] hover:bg-[#ff8c1a] transition-all flex items-center justify-center gap-3">
                  <span>{t("hero.checkAvailability", "Check")}</span>
                  <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Search className="h-5 w-5" />
                  </div>
                </motion.button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-8 pt-6 border-t border-white/10">
            <span className="text-sm text-white/60 font-black uppercase tracking-widest">{t("hero.popularSearches", "Popular:")}</span>
            {[{ label: t("nav.tours"), href: "/tours" }, { label: t("hero.airportTransfer", "Airport Transfer"), href: "/transfers" }, { label: t("hero.dayTours", "Day Tours"), href: "/tours" }].map(link => (
              <Link key={link.label} href={link.href}>
                <Button variant="secondary" size="sm" className="bg-white/10 hover:bg-[#f2800d] text-white font-bold rounded-full border border-white/10 hover:border-[#f2800d] transition-all backdrop-blur-md">{link.label}</Button>
              </Link>
            ))}
          </div>
        </motion.div>

        <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50"
          animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
          <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center p-1 backdrop-blur-sm">
            <motion.div className="w-1 h-2 bg-[#f2800d] rounded-full" animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
