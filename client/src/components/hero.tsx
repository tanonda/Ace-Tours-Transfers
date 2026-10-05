"use client";

/**
 * Hero — Skyscanner-inspired Redesign
 *
 * Design principles drawn from reference screenshots:
 * - Frosted-glass panel: white labels above separate translucent fields (user reference)
 * - Field labels sit above values inside the same cell
 * - Dark backdrop panel behind the search bar
 * - CTA button flush-right, same height as the bar, orange fill
 * - Tabs sit above the bar (Tours / Transfers)
 * - Guest counter as clean popover with +/− pill buttons and Apply CTA
 * - Calendar as floating panel, minimal with Close footer
 * - All search logic delegated to useAvailabilitySearch()
 */


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
  CalendarDays,
  Users,
  ChevronDown,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/page-hero";
import { useAvailabilitySearch, SearchTab } from "@/hooks/useAvailabilitySearch";
import { useSitePhoto } from "@/hooks/use-site-photo";

// ─── Bar height constant ──────────────────────────────────────────────────────
// 64px — matches Skyscanner's search bar proportions
const BAR_H = "h-16";

// Glass widget fields (user's reference): white label above a translucent rounded box.
const FIELD_LABEL = "mb-1.5 block text-[13px] font-semibold leading-none text-white";
const FIELD_BOX = cn(
  "flex h-12 w-full items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 text-left text-[15px] text-white",
  "backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
);

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
      <div className={cn("flex min-w-0 flex-col", className)}>
        <span className={FIELD_LABEL}>{label}</span>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${value ? format(value, "dd/MM/yyyy") : placeholder}`}
            className={cn(FIELD_BOX, open && "bg-white/20")}
          >
            <span className={cn("flex-1 truncate", !value && "text-white/70")}>
              {value ? format(value, "dd/MM/yyyy") : placeholder}
            </span>
            <CalendarDays className="h-4 w-4 shrink-0 text-white/70" />
          </button>
        </PopoverTrigger>
      </div>
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
      <div className={cn("flex min-w-0 flex-col", className)}>
        <span className={FIELD_LABEL}>{label}</span>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${summary}`}
            className={cn(FIELD_BOX, open && "bg-white/20")}
          >
            <Users className="h-4 w-4 shrink-0 text-white/70" />
            <span className="flex-1 truncate font-medium">{summary}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-white/70" />
          </button>
        </PopoverTrigger>
      </div>
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
    <div className={cn("flex min-w-0 flex-col", className)}>
      <label className={FIELD_LABEL}>{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(FIELD_BOX, "shadow-none placeholder:text-white/70 focus-visible:ring-offset-0")}
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
    <div className={cn("flex min-w-0 flex-col", className)}>
      <label className={FIELD_LABEL}>{label}</label>
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        // color-scheme: dark keeps the browser's clock icon visible on the glass.
        className={cn(FIELD_BOX, "shadow-none [color-scheme:dark] focus-visible:ring-offset-0 [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-calendar-picker-indicator]:cursor-pointer")}
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
    <div className={cn("flex min-w-0 flex-col", className)}>
      <span className={FIELD_LABEL}>{label}</span>
      <Select
        value={value ?? "all"}
        onValueChange={(v) => onChange(v === "all" ? null : v)}
      >
        <SelectTrigger
          aria-label={label}
          className={cn(FIELD_BOX, "justify-between shadow-none focus:ring-2 focus:ring-white/60 focus:ring-offset-0 [&>svg]:text-white [&>svg]:opacity-70")}
        >
          <span className={cn("truncate", isEmpty ? "text-white/70" : "font-medium")}>
            {displayText.split(" | ")[0]}
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
    <div role="tablist" aria-label="Search type" className="flex items-center gap-1 rounded-full bg-black/20 p-1">
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
              ? "bg-white text-[#12324a] shadow-sm"
              : "text-white/90 hover:text-white hover:bg-white/15"
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
  const { t } = useTranslation();
  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-script text-2xl text-[#ffe3c6] md:text-3xl">{search.activeTab === "transfer" ? t("hero.bookTransfer", "Book a transfer") : t("hero.checkAvailability", "Check availability")}</p>
        <SearchTabs
          activeTab={search.activeTab}
          onTabChange={search.setActiveTab}
        />
      </div>

      {/*
       * The unified white bar.
       * - No gaps between segments, only thin internal dividers
       * - Flush corners wrap around the whole bar including the CTA
       * - Shadow lifts the bar from the dark backdrop
       */}
      <div
        role="search"
        aria-label="Availability search"
        className="flex flex-col gap-3 md:flex-row md:items-end"
      >
        {/* Animated field panel */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={search.activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="grid min-w-0 flex-1 grid-cols-2 gap-3 md:flex md:flex-row md:items-end"
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
                  className="col-span-2 md:flex-[1.8] md:min-w-[200px]"
                />
                <DateCell
                  label="Date"
                  value={search.tour.date}
                  onChange={search.setTourDate}
                  placeholder="Add date"
                  divider
                  className="md:flex-1 md:min-w-[140px]"
                />
                <TimeCell
                  label="Pickup time"
                  value={search.tour.time}
                  onChange={search.setTourTime}
                  divider
                  className="md:flex-1 md:min-w-[110px]"
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
                  className="col-span-2 md:flex-1 md:min-w-[160px]"
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
                  className="col-span-2 md:flex-[1.5] md:min-w-[180px]"
                />
                <BarInput
                  label="To"
                  value={search.transfer.to}
                  onChange={search.setTransferTo}
                  placeholder="Drop-off point"
                  divider
                  className="col-span-2 md:flex-[1.5] md:min-w-[180px]"
                />
                <DateCell
                  label="Transfer date"
                  value={search.transfer.date}
                  onChange={search.setTransferDate}
                  placeholder="Add date"
                  divider
                  className="md:flex-1 md:min-w-[140px]"
                />
                <TimeCell
                  label="Pickup time"
                  value={search.transfer.time}
                  onChange={search.setTransferTime}
                  divider
                  className="md:flex-1 md:min-w-[110px]"
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
                  className="col-span-2 md:flex-1 md:min-w-[160px]"
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
            "flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-8 text-[15px] font-bold text-white shadow-lg transition-colors md:w-auto",
            // Stays orange (dimmed) until the form is complete, so it still reads as the action on the glass.
            search.isValid ? "bg-primary hover:bg-primary/90 cursor-pointer" : "bg-primary/60 cursor-not-allowed"
          )}
        >
          <Search className="h-4 w-4" />
          <span>{search.activeTab === "transfer" ? t("hero.searchTransfers", "Search transfers") : t("hero.searchTours", "Search tours")}</span>
        </button>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
// Home hero: the shared PageHero (reference-style fading headline) with the booking
// widget beneath. Height is capped to the screen so the widget is in view on load.
export function Hero() {
  const { t } = useTranslation();
  const cms = useCmsText("home-page");
  const search = useAvailabilitySearch();
  const bgUrl = useSitePhoto("homeHero"); // Admin → CMS → Home Page → hero_image
  const bgSrc = bgUrl.includes("res.cloudinary.com")
    ? bgUrl.replace("/upload/", "/upload/ar_16:9,c_fill,g_auto,f_auto,q_auto,w_1600/")
    : bgUrl;

  return (
    <PageHero
      size="home"
      priority
      photo={bgSrc}
      photoPosition="50% 40%"
      greeting={cms.text("hero_greeting", t("hero.greeting", "Greetings from Port Vila!"))}
      kicker={cms.text("hero_title_part1", t("hero.titlePart1"))}
      title={cms.text("hero_title_part2", t("hero.titlePart2"))}
    >
      {/* Frosted glass over the photo (user's reference). */}
      <div className="rounded-2xl border border-white/25 bg-[#0c1f2e]/45 p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-md md:p-5">
        <SearchBar search={search} />
      </div>
    </PageHero>
  );
}
