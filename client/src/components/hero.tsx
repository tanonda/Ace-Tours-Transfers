"use client";

/**
 * Hero — Skyscanner-inspired Redesign
 *
 * Design principles drawn from reference screenshots:
 * - Single unified white bar with hard vertical dividers between fields (no gaps/islands)
 * - Field labels sit above values inside the same cell
 * - Dark backdrop panel behind the search bar
 * - CTA button flush-right, same height as the bar, orange fill
 * - Tabs sit above the bar (Tours / Transfers)
 * - Guest counter as clean popover with +/− pill buttons and Apply CTA
 * - Calendar as floating panel, minimal with Close footer
 * - All search logic delegated to useAvailabilitySearch()
 */

// Sunset over the yachts at Mele, Efate (DB Thats-Me, CC BY-SA 3.0; see image-credits.ts).
// Admin → CMS "hero_image" overrides it.
const heroBg = "/assets/home/mele-sunset-yachts.webp";

import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useCmsText } from "@/hooks/use-cms-text";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Search,
  Map,
  Car,
  Minus,
  Plus,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { PaperEdge } from "@/components/postcard";
import { useAvailabilitySearch, SearchTab } from "@/hooks/useAvailabilitySearch";

// ─── Bar height constant ──────────────────────────────────────────────────────
// 64px — matches Skyscanner's search bar proportions
const BAR_H = "h-16";

// ─── DateCell ────────────────────────────────────────────────────────────────
// Opens a calendar popover. Renders as a flush bar segment with vertical divider.
interface DateCellProps {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  minDate?: Date;
  placeholder?: string;
  divider?: boolean;
  className?: string;
}
function DateCell({
  label,
  value,
  onChange,
  minDate,
  placeholder = "Add date",
  divider = true,
  className,
}: DateCellProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${value ? format(value, "dd/MM/yyyy") : placeholder}`}
          className={cn(
            "relative flex flex-col justify-center px-4 py-3 text-left h-full w-full",
            "transition-colors duration-150 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50",
            open && "bg-blue-50/50",
            // Right divider on desktop, bottom divider on mobile
            divider &&
            "md:after:absolute md:after:right-0 md:after:top-[20%] md:after:bottom-[20%] md:after:w-px md:after:h-auto md:after:bg-gray-200 after:absolute after:bottom-0 after:left-[5%] after:right-[5%] after:h-px after:w-auto after:bg-gray-200 md:after:left-auto md:after:right-0",
            className
          )}
        >
          <span className="text-[11px] font-semibold text-gray-500 leading-none mb-[6px]">
            {label}
          </span>
          <span
            className={cn(
              "text-[15px] font-semibold leading-tight",
              value ? "text-gray-900" : "text-gray-400 font-normal"
            )}
          >
            {value ? format(value, "dd/MM/yyyy") : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 rounded-xl border-gray-200 shadow-2xl"
        align="start"
        sideOffset={10}
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
          disabled={(d) => d < (minDate ?? new Date())}
          initialFocus
        />
        <div className="border-t border-gray-100 px-4 py-3 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── GuestsCell ───────────────────────────────────────────────────────────────
// Counter popover — 4 rows: Adults, Children, Infants, Pets.
// Matches the Airbnb pattern from the reference screenshot.
// Infants (under 2) and Pets are free — noted with a "Free" badge.

interface GuestsCellProps {
  label: string;
  summary: string;
  adults: number;
  children: number;
  infants: number;             // NEW
  pets: number;                // NEW
  onAdultsChange: (n: number) => void;
  onChildrenChange: (n: number) => void;
  onInfantsChange: (n: number) => void;  // NEW
  onPetsChange: (n: number) => void;  // NEW
  divider?: boolean;
  className?: string;
}

function CounterRow({
  label,
  sub,
  value,
  onInc,
  onDec,
  min = 0,
  max = 50,
  badge,
}: {
  label: string;
  sub: string;
  value: number;
  onInc: () => void;
  onDec: () => void;
  min?: number;
  max?: number;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-semibold text-gray-900">{label}</p>
          {badge}
        </div>
        <p className="text-[13px] text-gray-400 mt-0.5">{sub}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onDec}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="h-8 w-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="text-[15px] font-semibold text-gray-900 w-5 text-center tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={onInc}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="h-8 w-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// "Free" badge shown next to Infants and Pets labels
function FreeBadge() {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-50 text-green-600 leading-none">
      Free
    </span>
  );
}

function GuestsCell({
  label,
  summary,
  adults,
  children,
  infants,
  pets,
  onAdultsChange,
  onChildrenChange,
  onInfantsChange,
  onPetsChange,
  divider = false,
  className,
}: GuestsCellProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${summary}`}
          className={cn(
            "relative flex flex-col justify-center px-4 py-3 text-left h-full w-full",
            "transition-colors duration-150 hover:bg-gray-50 focus-visible:outline-none focus-visible:bg-gray-50",
            open && "bg-blue-50/50",
            divider &&
            "md:after:absolute md:after:right-0 md:after:top-[20%] md:after:bottom-[20%] md:after:w-px md:after:h-auto md:after:bg-gray-200 after:absolute after:bottom-0 after:left-[5%] after:right-[5%] after:h-px after:w-auto after:bg-gray-200 md:after:left-auto md:after:right-0",
            className
          )}
        >
          <span className="text-[11px] font-semibold text-gray-500 leading-none mb-[6px]">
            {label}
          </span>
          <span className="text-[15px] font-semibold text-gray-900 leading-tight truncate">
            {summary}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 rounded-xl border-gray-200 shadow-2xl"
        align="end"
        sideOffset={10}
      >
        <div className="px-5 pt-5 space-y-4" role="group" aria-label={`${label} selection`}>
          {/* Adults */}
          <CounterRow
            label="Adults"
            sub="Ages 13 or above"
            value={adults}
            onInc={() => onAdultsChange(Math.min(50, adults + 1))}
            onDec={() => onAdultsChange(Math.max(1, adults - 1))}
            min={1}
          />
          <div className="h-px bg-gray-100" />

          {/* Children */}
          <CounterRow
            label="Children"
            sub="Ages 2–12"
            value={children}
            onInc={() => onChildrenChange(Math.min(30, children + 1))}
            onDec={() => onChildrenChange(Math.max(0, children - 1))}
          />
          <div className="h-px bg-gray-100" />

          {/* Infants — FREE, no seat/capacity impact */}
          <CounterRow
            label="Infants"
            sub="Under 2"
            badge={<FreeBadge />}
            value={infants}
            onInc={() => onInfantsChange(Math.min(10, infants + 1))}
            onDec={() => onInfantsChange(Math.max(0, infants - 1))}
          />
          <div className="h-px bg-gray-100" />

          {/* Pets — FREE, manifesting only */}
          <CounterRow
            label="Pets"
            sub="Bringing a service animal?"
            badge={<FreeBadge />}
            value={pets}
            onInc={() => onPetsChange(Math.min(10, pets + 1))}
            onDec={() => onPetsChange(Math.max(0, pets - 1))}
          />
        </div>

        <div className="px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full h-10 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg text-sm transition-colors"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── BarInput ─────────────────────────────────────────────────────────────────
// A plain text input rendered as a flush bar segment with vertical divider.
interface BarInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  divider?: boolean;
  className?: string;
}
function BarInput({
  label,
  value,
  onChange,
  placeholder,
  divider = true,
  className,
}: BarInputProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-center px-4 py-3 h-full",
        "transition-colors duration-150 hover:bg-gray-50 focus-within:bg-gray-50",
        divider &&
        "md:after:absolute md:after:right-0 md:after:top-[20%] md:after:bottom-[20%] md:after:w-px md:after:h-auto md:after:bg-gray-200 after:absolute after:bottom-0 after:left-[5%] after:right-[5%] after:h-px after:w-auto after:bg-gray-200 md:after:left-auto md:after:right-0",
        className
      )}
    >
      <label className="text-[11px] font-semibold text-gray-500 leading-none mb-[6px]">
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-0 bg-transparent shadow-none p-0 h-auto text-[15px] font-semibold text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus-visible:ring-0 leading-tight"
      />
    </div>
  );
}

// ─── TimeCell ─────────────────────────────────────────────────────────────────
// A time input rendered as a flush bar segment with vertical divider.
interface TimeCellProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  divider?: boolean;
  className?: string;
}
function TimeCell({
  label,
  value,
  onChange,
  divider = true,
  className,
}: TimeCellProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-center px-4 py-3 h-full",
        "transition-colors duration-150 hover:bg-gray-50 focus-within:bg-gray-50",
        divider &&
        "md:after:absolute md:after:right-0 md:after:top-[20%] md:after:bottom-[20%] md:after:w-px md:after:h-auto md:after:bg-gray-200 after:absolute after:bottom-0 after:left-[5%] after:right-[5%] after:h-px after:w-auto after:bg-gray-200 md:after:left-auto md:after:right-0",
        className
      )}
    >
      <label className="text-[11px] font-semibold text-gray-500 leading-none mb-[6px]">
        {label}
      </label>
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-0 bg-transparent shadow-none p-0 h-auto text-[15px] font-semibold text-gray-900 focus-visible:ring-0 leading-tight [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
      />
    </div>
  );
}

// ─── ProductCell ──────────────────────────────────────────────────────────────
// A Select rendered flush inside the bar with the standard label-above-value layout.
interface ProductCellProps {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  products: any[];
  placeholder: string;
  divider?: boolean;
  className?: string;
}
function ProductCell({
  label,
  value,
  onChange,
  products,
  placeholder,
  divider = true,
  className,
}: ProductCellProps) {
  const selected = products.find((p) => p.id?.toString() === value);
  const displayText = selected ? selected.title : placeholder;
  const isEmpty = !selected;

  return (
    <div
      className={cn(
        "relative flex-1 min-w-0",
        divider &&
        "md:after:absolute md:after:right-0 md:after:top-[20%] md:after:bottom-[20%] md:after:w-px md:after:h-auto md:after:bg-gray-200 md:after:z-10 after:absolute after:bottom-0 after:left-[5%] after:right-[5%] after:h-px after:w-auto after:bg-gray-200 md:after:left-auto md:after:right-0",
        className
      )}
    >
      <Select
        value={value ?? "all"}
        onValueChange={(v) => onChange(v === "all" ? null : v)}
      >
        <SelectTrigger
          aria-label={label}
          className={cn(
            "h-full w-full border-0 bg-transparent shadow-none rounded-none px-4",
            "flex flex-col items-start justify-center gap-0 [&>svg]:hidden",
            "hover:bg-gray-50 focus:ring-0 transition-colors duration-150"
          )}
        >
          <span className="text-[11px] font-semibold text-gray-500 leading-none mb-[6px]">
            {label}
          </span>
          <span
            className={cn(
              "text-[15px] leading-tight",
              isEmpty ? "text-gray-400 font-normal" : "text-gray-900 font-semibold"
            )}
          >
            {displayText}
          </span>
        </SelectTrigger>
        <SelectContent className="rounded-xl border-gray-200 shadow-2xl p-1">
          <SelectItem value="all" className="py-2.5 text-sm focus:bg-orange-50 focus:text-orange-900">
            <span className="font-semibold">All</span>
          </SelectItem>
          {products.length > 0 && (
            <>
              <SelectSeparator className="my-1 bg-gray-100" />
              {products.map((p) => (
                <SelectItem
                  key={p.id}
                  value={p.id.toString()}
                  className="py-2.5 text-sm focus:bg-orange-50 focus:text-orange-900"
                >
                  {p.title}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── SearchTabs ───────────────────────────────────────────────────────────────
// Pill-style tabs sitting above the search bar (like Skyscanner's One way / Return tabs).
const TABS: { id: SearchTab; icon: React.ReactNode; label: string }[] = [
  { id: "tour", icon: <Map className="h-3.5 w-3.5" />, label: "Tours" },
  { id: "transfer", icon: <Car className="h-3.5 w-3.5" />, label: "Transfers" },
];

interface SearchTabsProps {
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
}
function SearchTabs({ activeTab, onTabChange }: SearchTabsProps) {
  return (
    <div role="tablist" aria-label="Search type" className="flex items-center gap-1 mb-3">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`search-panel-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200",
            activeTab === tab.id
              ? "bg-harbour text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── SearchBar ────────────────────────────────────────────────────────────────
interface SearchBarProps {
  search: ReturnType<typeof useAvailabilitySearch>;
}
function SearchBar({ search }: SearchBarProps) {
  return (
    <div className="w-full">
      <SearchTabs
        activeTab={search.activeTab}
        onTabChange={search.setActiveTab}
      />

      {/*
       * The unified white bar.
       * - No gaps between segments, only thin internal dividers
       * - Flush corners wrap around the whole bar including the CTA
       * - Shadow lifts the bar from the dark backdrop
       */}
      <div
        role="search"
        aria-label="Availability search"
        className={cn(
          "flex flex-col md:flex-row md:items-stretch bg-white rounded-xl overflow-hidden",
          "border border-border",
          "md:h-16"
        )}
      >
        {/* Animated field panel */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={search.activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex flex-col md:flex-row flex-1 md:items-stretch min-w-0 overflow-hidden"
          >

            {/* ── Tours ── */}
            {search.activeTab === "tour" && (
              <>
                <ProductCell
                  label="Tour"
                  value={search.selectedProductId}
                  onChange={search.setSelectedProductId}
                  products={search.tours}
                  placeholder="All tours"
                  divider
                  className="flex-[1.8] min-w-0 md:min-w-[200px]"
                />
                <DateCell
                  label="Date"
                  value={search.tour.date}
                  onChange={search.setTourDate}
                  placeholder="Add date"
                  divider
                  className="flex-1 min-w-0 md:min-w-[140px]"
                />
                <TimeCell
                  label="Pickup time"
                  value={search.tour.time}
                  onChange={search.setTourTime}
                  divider
                  className="flex-1 min-w-0 md:min-w-[110px]"
                />
                <GuestsCell
                  label="Guests"
                  summary={search.tourGuestSummary}
                  adults={search.tour.adults}
                  children={search.tour.children}
                  infants={search.tour.infants}
                  pets={search.tour.pets}
                  onAdultsChange={search.setTourAdults}
                  onChildrenChange={search.setTourChildren}
                  onInfantsChange={search.setTourInfants}
                  onPetsChange={search.setTourPets}
                  className="flex-1 min-w-0 md:min-w-[160px]"
                />
              </>
            )}

            {/* ── Transfers ── */}
            {search.activeTab === "transfer" && (
              <>
                <ProductCell
                  label="Transfer"
                  value={search.selectedProductId}
                  onChange={search.setSelectedProductId}
                  products={search.transfers}
                  placeholder="All transfers"
                  divider
                  className="flex-[1.5] min-w-0 md:min-w-[180px]"
                />
                <BarInput
                  label="To"
                  value={search.transfer.to}
                  onChange={search.setTransferTo}
                  placeholder="Drop-off point"
                  divider
                  className="flex-[1.5] min-w-0 md:min-w-[180px]"
                />
                <DateCell
                  label="Transfer date"
                  value={search.transfer.date}
                  onChange={search.setTransferDate}
                  placeholder="Add date"
                  divider
                  className="flex-1 min-w-0 md:min-w-[140px]"
                />
                <TimeCell
                  label="Pickup time"
                  value={search.transfer.time}
                  onChange={search.setTransferTime}
                  divider
                  className="flex-1 min-w-0 md:min-w-[110px]"
                />
                <GuestsCell
                  label="Passengers"
                  summary={search.transferPassengerSummary}
                  adults={search.transfer.adults}
                  children={search.transfer.children}
                  infants={search.transfer.infants}
                  pets={search.transfer.pets}
                  onAdultsChange={search.setTransferAdults}
                  onChildrenChange={search.setTransferChildren}
                  onInfantsChange={search.setTransferInfants}
                  onPetsChange={search.setTransferPets}
                  className="flex-1 min-w-0 md:min-w-[160px]"
                />
              </>
            )}

          </motion.div>
        </AnimatePresence>

        {/*
         * Primary CTA — same height as bar, flush right.
         * Orange when valid, muted gray when fields incomplete.
         * Matches Skyscanner's blue Search button pattern.
         */}
        <button
          type="button"
          onClick={search.handleSearch}
          aria-label="Search availability"
          aria-disabled={!search.isValid}
          title={!search.isValid ? search.validationMessage : undefined}
          className={cn(
            "flex items-center justify-center gap-2 px-7 shrink-0",
            "font-bold text-[15px] text-white",
            "transition-colors duration-150",
            // Full width on mobile, flush-right on desktop
            "rounded-none w-full md:w-auto py-4 md:py-0",
            search.isValid
              ? "bg-primary hover:bg-primary/90 cursor-pointer"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
        </button>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
// Postcard layout sized for a booking site: the hero never grows taller than the
// screen, so the search widget is in view on load (down to ~600px-tall laptop
// windows). Handwritten greeting, extruded headline, torn-paper bottom edge.
export function Hero() {
  const { t } = useTranslation();
  const cms = useCmsText("home-page");
  const search = useAvailabilitySearch();
  const bgUrl = cms.text("hero_image") || heroBg;
  const bgSrc = bgUrl.includes("res.cloudinary.com")
    ? bgUrl.replace("/upload/", "/upload/ar_16:9,c_fill,g_auto,f_auto,q_auto,w_1600/")
    : bgUrl;

  return (
    <section
      className="relative w-full overflow-hidden bg-harbour md:h-[100svh] md:min-h-[600px] md:max-h-[880px]"
      aria-label="Hero — search for tours and transfers"
    >
      {/* Background image — real <img> tag enables fetchpriority=high for LCP */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <img
          src={bgSrc}
          alt=""
          className="w-full h-full object-cover object-[50%_40%]"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b from-transparent to-background/70" />
      </div>

      <div className="relative container mx-auto px-4 flex h-full flex-col justify-end pt-52 pb-14 md:pt-32 md:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-white mb-6 md:mb-8"
        >
          <p className="font-script text-2xl md:text-[clamp(1.6rem,4vh,2.4rem)] text-[#ffe3c6] -rotate-2 origin-left mb-1 drop-shadow">
            {cms.text("hero_greeting", t("hero.greeting", "Greetings from Port Vila!"))}
          </p>
          {/* h1 preserved for SEO */}
          <h1 className="hero-3d font-serif text-[2.6rem] sm:text-6xl md:text-[clamp(3rem,min(6.4vw,9vh),5.5rem)] leading-[1.02]">
            <span className="block">{cms.text("hero_title_part1", t("hero.titlePart1"))}</span>
            <span className="block">{cms.text("hero_title_part2", t("hero.titlePart2"))}</span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="w-full z-20"
        >
          <div className="bg-paper rounded-xl p-3 md:p-4 border border-border/60 shadow-[0_24px_60px_-20px_rgba(18,50,74,0.5)]">
            <SearchBar search={search} />
          </div>
        </motion.div>
      </div>

      <PaperEdge position="bottom" seed={3} />
    </section>
  );
}
