
import heroBg from "@assets/stock_images/vanuatu_tropical_bea_1818375e.jpg";
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
import { tours, transfers } from "@/lib/data";

export function Hero() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [serviceType, setServiceType] = useState<string>("");
  const [guests, setGuests] = useState<string>("2");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (selectedDate) params.set("date", format(selectedDate, "yyyy-MM-dd"));
    if (serviceType) params.set("service", serviceType);
    if (guests) params.set("guests", guests);
    
    const isTransfer = serviceType === "all-transfers" || serviceType.startsWith("transfer-");
    if (isTransfer) {
      setLocation(`/transfers?${params.toString()}`);
    } else {
      setLocation(`/tours?${params.toString()}`);
    }
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      </div>
      {/* Content */}
      <div className="relative container mx-auto px-4 flex flex-col justify-center items-center text-center text-white pt-28 pb-20 md:pt-36 md:pb-24 min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl"
        >
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl mb-4 leading-tight drop-shadow-xl">
            <span className="text-white font-bold">{t("hero.titlePart1")} </span>
            <span className="text-[#f2800d] italic font-normal lowercase">{t("hero.titlePart2")}</span>
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto font-light leading-relaxed">
            {t("home.toursDesc")}
          </p>
        </motion.div>

        {/* Availability Checker Widget */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="w-full max-w-4xl"
        >
          <div className="bg-gradient-to-br from-white/95 via-primary/5 to-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-4 md:p-6 border border-primary/20 ring-1 ring-primary/10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:items-end">
              {/* Service Type */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-primary/80 flex items-center gap-2">
                  <Map className="h-4 w-4 text-primary" />
                  {t("hero.serviceType", "What are you looking for?")}
                </label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger className="h-14 text-base bg-white border-primary/20 hover:border-primary/40 focus:ring-primary/30 shadow-sm" data-testid="select-service-type">
                    <SelectValue placeholder={t("hero.selectService", "Tours & Transfers")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-tours" className="py-3">
                      <div className="flex items-center gap-2">
                        <Map className="h-4 w-4" />
                        {t("hero.allTours", "All Tours")}
                      </div>
                    </SelectItem>
                    {tours.slice(0, 4).map((tour) => (
                      <SelectItem key={tour.id} value={`tour-${tour.id}`} className="py-3">
                        {tour.title}
                      </SelectItem>
                    ))}
                    <SelectItem value="all-transfers" className="py-3">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        {t("hero.allTransfers", "All Transfers")}
                      </div>
                    </SelectItem>
                    {transfers.slice(0, 3).map((transfer) => (
                      <SelectItem key={transfer.id} value={`transfer-${transfer.id}`} className="py-3">
                        {transfer.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-primary/80 flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  {t("hero.travelDate", "When?")}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-14 justify-start text-left text-base font-normal bg-white border-primary/20 hover:border-primary/40 shadow-sm",
                        !selectedDate && "text-muted-foreground"
                      )}
                      data-testid="button-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-5 w-5 text-muted-foreground" />
                      {selectedDate ? format(selectedDate, "EEE, MMM d, yyyy") : t("hero.pickDate", "Pick a date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
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
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-primary/80 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {t("hero.guests", "How many?")}
                </label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/50" />
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    className="h-14 text-base pl-12 bg-white border-primary/20 hover:border-primary/40 shadow-sm"
                    placeholder={t("hero.guestsPlaceholder", "2 guests")}
                    data-testid="input-guests"
                  />
                </div>
              </div>

              {/* Search Button */}
              <div className="flex flex-col gap-2 justify-end">
                <Button
                  onClick={handleSearch}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] transition-all duration-200"
                  data-testid="button-check-availability"
                >
                  <Search className="mr-2 h-5 w-5" />
                  {t("hero.checkAvailability", "Check Availability")}
                </Button>
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 pt-4 border-t border-primary/10">
              <span className="text-sm text-primary/60 font-medium">{t("hero.popularSearches", "Popular:")}</span>
              <Link href="/tours">
                <Button variant="ghost" size="sm" className="text-sm text-primary font-medium hover:bg-primary/10 hover:text-primary">
                  {t("nav.tours")}
                </Button>
              </Link>
              <Link href="/transfers">
                <Button variant="ghost" size="sm" className="text-sm text-primary font-medium hover:bg-primary/10 hover:text-primary">
                  {t("hero.airportTransfer", "Airport Transfer")}
                </Button>
              </Link>
              <Link href="/tours">
                <Button variant="ghost" size="sm" className="text-sm text-primary font-medium hover:bg-primary/10 hover:text-primary">
                  {t("hero.dayTours", "Day Tours")}
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
      {/* Scroll Indicator */}
      <motion.div 
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60"
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
