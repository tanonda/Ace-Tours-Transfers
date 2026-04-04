"use client";

/**
 * Hero — Skyscanner-inspired Redesign
 *
 * Design principles drawn from reference screenshots:
 * - Single unified white bar with hard vertical dividers between fields (no gaps/islands)
 * - Field labels sit above values inside the same cell
 * - Dark backdrop panel behind the search bar
 * - CTA button flush-right, same height as the bar, orange fill
 * - Tabs sit above the bar (Tours / Transfers / Vehicle Hire)
 * - Guest counter as clean popover with +/− pill buttons and Apply CTA
 * - Calendar as floating panel, minimal with Close footer
 * - All search logic delegated to useAvailabilitySearch()
 */

const heroBg =
  "https://res.cloudinary.com/dwro1dh5q/image/upload/v1765063929/ace-tours-assets/ace_tours_hero_beach.jpg";

import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useCmsText } from "@/hooks/use-cms-text";
import { useCMS } from "@/lib/cms-context";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  Truck,
  Minus,
  Plus,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
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
            className="w-full h-10 bg-[#f2800d] hover:bg-[#e07008] text-white font-bold rounded-lg text-sm transition-colors"
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
  { id: "vehicle", icon: <Truck className="h-3.5 w-3.5" />, label: "Vehicle Hire" },
];

interface SearchTabsProps {
  activeTab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  showVehicleHire?: boolean;
}
function SearchTabs({ activeTab, onTabChange, showVehicleHire = true }: SearchTabsProps) {
  const availableTabs = TABS.filter(t => t.id !== 'vehicle' || showVehicleHire);
  return (
    <div role="tablist" aria-label="Search type" className="flex items-center gap-1 mb-3">
      {availableTabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`search-panel-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200",
            activeTab === tab.id
              ? "bg-white text-gray-900 shadow-sm"
              : "text-white/75 hover:text-white hover:bg-white/10"
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
  showVehicleHire?: boolean;
}
function SearchBar({ search, showVehicleHire }: SearchBarProps) {
  return (
    <div className="w-full">
      <SearchTabs
        activeTab={search.activeTab}
        onTabChange={search.setActiveTab}
        showVehicleHire={showVehicleHire}
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
          "shadow-[0_2px_24px_rgba(0,0,0,0.22)]",
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

            {/* ── Vehicle Hire ── */}
            {search.activeTab === "vehicle" && (
              <>
                <ProductCell
                  label="Vehicle type"
                  value={search.selectedProductId}
                  onChange={search.setSelectedProductId}
                  products={search.vehicles}
                  placeholder="Any vehicle"
                  divider
                  className="flex-[1.5] min-w-0 md:min-w-[180px]"
                />
                <DateCell
                  label="Pick-up date"
                  value={search.vehicle.pickupDate}
                  onChange={search.setPickupDate}
                  placeholder="Add date"
                  divider
                  className="flex-1 min-w-0 md:min-w-[130px]"
                />
                <TimeCell
                  label="Time"
                  value={search.vehicle.pickupTime}
                  onChange={search.setPickupTime}
                  divider
                  className="flex-1 min-w-0 md:min-w-[100px]"
                />
                <DateCell
                  label="Drop-off date"
                  value={search.vehicle.returnDate}
                  onChange={search.setReturnDate}
                  minDate={
                    search.vehicle.pickupDate
                      ? addDays(search.vehicle.pickupDate, 1)
                      : new Date()
                  }
                  placeholder="Add date"
                  divider
                  className="flex-1 min-w-0 md:min-w-[130px]"
                />
                <TimeCell
                  label="Time"
                  value={search.vehicle.returnTime}
                  onChange={search.setReturnTime}
                  divider={search.hireDays > 0}
                  className="flex-1 min-w-0 md:min-w-[100px]"
                />
                {/* Duration badge — appears inline when both dates set */}
                <AnimatePresence>
                  {search.hireDays > 0 && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 72 }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex items-center justify-center shrink-0 overflow-hidden"
                    >
                      <div className="text-center px-2">
                        <p className="text-[17px] font-black text-[#f2800d] leading-none">
                          {search.hireDays}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">
                          {search.hireDays === 1 ? "day" : "days"}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
              ? "bg-[#f2800d] hover:bg-[#e07008] cursor-pointer"
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
export function Hero() {
  const { t } = useTranslation();
  const cms = useCmsText("home-page");
  const { isBlockEnabled } = useCMS();
  const showVehicleHire = isBlockEnabled('vehicle-hire');
  const search = useAvailabilitySearch();
  const bgUrl = cms.text("hero_image") || heroBg;

  return (
    <section
      className="relative min-h-[85vh] md:min-h-screen w-full overflow-hidden"
      aria-label="Hero — search for tours, transfers and vehicles"
    >
      {/* Background image + gradient — real <img> tag enables fetchpriority=high for LCP */}
      <div
        className="absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <img
          src={bgUrl.replace("/upload/", "/upload/ar_16:9,c_fill,g_auto,f_auto,q_auto,w_1600/")}
          alt=""
          className="w-full h-full object-cover object-center"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/65" />
      </div>

      <div className="relative container mx-auto px-4 flex flex-col justify-center items-center text-center text-white pt-44 pb-16 md:pt-52 md:pb-24 min-h-[85vh] md:min-h-screen">

        {/* Headline — h1 preserved for SEO */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl mb-6 md:mb-10"
        >
          <h1 className="font-serif text-4xl md:text-7xl lg:text-8xl mb-4 md:mb-5 leading-[1.1] drop-shadow-[0_4px_8px_rgba(0,0,0,0.55)]">
            <span className="text-white font-bold block md:inline">
              {cms.text("hero_title_part1", t("hero.titlePart1"))}{" "}
            </span>
            <span className="text-[#f2800d] italic font-normal lowercase">
              {cms.text("hero_title_part2", t("hero.titlePart2"))}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/80 drop-shadow-md max-w-2xl mx-auto font-medium leading-relaxed">
            {cms.text("hero_subtitle", t("home.toursDesc"))}
          </p>
        </motion.div>

        {/* Dark backing panel + search bar */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-5xl z-10"
        >
          {/*
           * Dark semi-transparent backing panel — mirrors the navy/dark panel
           * Skyscanner uses behind its search bar, giving the white bar visual lift.
           */}
          <div className="bg-black/35 backdrop-blur-xl rounded-2xl p-4 md:p-5 border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
            <SearchBar search={search} />
          </div>

          {/* Popular searches */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-7">
            <span className="text-xs text-white/50 font-bold uppercase tracking-widest">
              {t("hero.popularSearches", "Popular:")}
            </span>
            {[
              { label: t("nav.tours"), href: "/tours" },
              { label: t("hero.airportTransfer", "Airport Transfer"), href: "/transfers" },
              { label: t("hero.dayTours", "Day Tours"), href: "/tours" },
            ].map((link) => (
              <Link key={link.label} href={link.href}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white/80 hover:text-white font-semibold rounded-full border border-white/15 transition-all backdrop-blur-md text-xs"
                >
                  {link.label}
                </Button>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/40"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        >
          <div className="w-5 h-9 border border-white/20 rounded-full flex justify-center p-1">
            <motion.div
              className="w-1 h-2 bg-[#f2800d]/70 rounded-full"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
