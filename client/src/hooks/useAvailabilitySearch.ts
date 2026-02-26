/**
 * useAvailabilitySearch — updated for infant + pet pax
 *
 * Decoupled search/availability logic for the Ace Tours Hero search bar.
 * Now tracks infantPax and petPax in all three category states.
 *
 * Pricing note: infants and pets are FREE and do not consume capacity.
 * They are collected here for manifesting purposes only.
 */

import { useState, useMemo, useCallback } from "react";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchTours } from "@/lib/api";
import { useBookingDraft } from "@/lib/booking-state-context";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchTab = "tour" | "transfer" | "vehicle";

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number; // NEW — under 2, free
  pets: number;    // NEW — free
}

export interface TourSearchState extends GuestCounts {
  date: Date | undefined;
  time: string;
}

export interface TransferSearchState extends GuestCounts {
  from: string;
  to: string;
  date: Date | undefined;
  time: string;
}

export interface VehicleSearchState {
  pickupDate: Date | undefined;
  pickupTime: string;
  returnDate: Date | undefined;
  returnTime: string;
}

export interface AvailabilitySearchResult {
  // Tab
  activeTab: SearchTab;
  setActiveTab: (tab: SearchTab) => void;

  // Tour
  tour: TourSearchState;
  setTourDate: (d: Date | undefined) => void;
  setTourTime: (t: string) => void;
  setTourAdults: (n: number) => void;
  setTourChildren: (n: number) => void;
  setTourInfants: (n: number) => void;  // NEW
  setTourPets: (n: number) => void;     // NEW

  // Transfer
  transfer: TransferSearchState;
  setTransferFrom: (s: string) => void;
  setTransferTo: (s: string) => void;
  setTransferDate: (d: Date | undefined) => void;
  setTransferTime: (t: string) => void;
  setTransferAdults: (n: number) => void;
  setTransferChildren: (n: number) => void;
  setTransferInfants: (n: number) => void;  // NEW
  setTransferPets: (n: number) => void;     // NEW

  // Vehicle
  vehicle: VehicleSearchState;
  setPickupDate: (d: Date | undefined) => void;
  setPickupTime: (t: string) => void;
  setReturnDate: (d: Date | undefined) => void;
  setReturnTime: (t: string) => void;

  // Products
  allProducts: any[];
  tours: any[];
  transfers: any[];
  vehicles: any[];
  isLoadingProducts: boolean;
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;

  // Derived
  hireDays: number;
  tourGuestSummary: string;
  transferPassengerSummary: string;

  // Validation
  isValid: boolean;
  validationMessage: string;

  // Submit
  handleSearch: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a concise guest summary string matching Airbnb/Skyscanner convention.
 * Infants and pets are shown but noted as free.
 */
function buildGuestSummary(adults: number, children: number, infants: number, pets: number): string {
  const parts: string[] = [];
  parts.push(adults === 1 ? "1 Adult" : `${adults} Adults`);
  if (children > 0) parts.push(children === 1 ? "1 Child" : `${children} Children`);
  if (infants > 0) parts.push(infants === 1 ? "1 Infant" : `${infants} Infants`);
  if (pets > 0) parts.push(pets === 1 ? "1 Pet" : `${pets} Pets`);
  return parts.join(", ");
}

function filterProducts(allTours: any[]) {
  return allTours.filter((t) => {
    if (!t?.title) return false;
    if (t.isActive === false) return false;
    const tl = t.title.toLowerCase();
    return (
      !tl.includes("verification") &&
      !tl.includes("concurrent") &&
      !tl.includes("test_tour") &&
      !tl.includes("phase4")
    );
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAvailabilitySearch(): AvailabilitySearchResult {
  const [, setLocation] = useLocation();
  const { updateDraft } = useBookingDraft();

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<SearchTab>("tour");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const handleSetActiveTab = useCallback((tab: SearchTab) => {
    setActiveTab(tab);
    setSelectedProductId(null);
  }, []);

  // ── Tour state ────────────────────────────────────────────────────────────
  const [tourDate, setTourDate] = useState<Date | undefined>(undefined);
  const [tourTime, setTourTime] = useState("10:00");
  const [tourAdults, setTourAdults] = useState(2);
  const [tourChildren, setTourChildren] = useState(0);
  const [tourInfants, setTourInfants] = useState(0); // NEW
  const [tourPets, setTourPets] = useState(0); // NEW

  // ── Transfer state ────────────────────────────────────────────────────────
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferDate, setTransferDate] = useState<Date | undefined>(undefined);
  const [transferTime, setTransferTime] = useState("10:00");
  const [transferAdults, setTransferAdults] = useState(2);
  const [transferChildren, setTransferChildren] = useState(0);
  const [transferInfants, setTransferInfants] = useState(0); // NEW
  const [transferPets, setTransferPets] = useState(0); // NEW

  // ── Vehicle state ─────────────────────────────────────────────────────────
  const [pickupDate, setPickupDateRaw] = useState<Date | undefined>(undefined);
  const [pickupTime, setPickupTime] = useState("10:00");
  const [returnDate, setReturnDateRaw] = useState<Date | undefined>(undefined);
  const [returnTime, setReturnTime] = useState("10:00");

  const setPickupDate = useCallback((d: Date | undefined) => {
    setPickupDateRaw(d);
    if (d && returnDate && returnDate <= d) setReturnDateRaw(addDays(d, 1));
  }, [returnDate]);

  const setReturnDate = useCallback((d: Date | undefined) => {
    setReturnDateRaw(d);
  }, []);

  // ── Product data ──────────────────────────────────────────────────────────
  const { data: rawProducts = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
    staleTime: 5 * 60 * 1000,
  });

  const allProducts = useMemo(() => filterProducts(rawProducts), [rawProducts]);
  const tours = useMemo(() => allProducts.filter((p) => p.category === "tour"), [allProducts]);
  const transfers = useMemo(() => allProducts.filter((p) => p.category === "transfer"), [allProducts]);
  const vehicles = useMemo(() => allProducts.filter((p) => p.category === "vehicle"), [allProducts]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const hireDays = useMemo(() => {
    if (!pickupDate || !returnDate) return 0;
    return Math.max(1, differenceInCalendarDays(returnDate, pickupDate));
  }, [pickupDate, returnDate]);

  const tourGuestSummary = useMemo(
    () => buildGuestSummary(tourAdults, tourChildren, tourInfants, tourPets),
    [tourAdults, tourChildren, tourInfants, tourPets]
  );

  const transferPassengerSummary = useMemo(
    () => buildGuestSummary(transferAdults, transferChildren, transferInfants, transferPets),
    [transferAdults, transferChildren, transferInfants, transferPets]
  );

  // ── Validation ────────────────────────────────────────────────────────────
  const { isValid, validationMessage } = useMemo(() => {
    if (activeTab === "tour") {
      if (!tourDate) return { isValid: false, validationMessage: "Please select a tour date" };
      return { isValid: true, validationMessage: "" };
    }
    if (activeTab === "transfer") {
      if (!transferDate) return { isValid: false, validationMessage: "Please select a transfer date" };
      return { isValid: true, validationMessage: "" };
    }
    if (activeTab === "vehicle") {
      if (!pickupDate) return { isValid: false, validationMessage: "Please select a pickup date" };
      if (!returnDate) return { isValid: false, validationMessage: "Please select a return date" };
      return { isValid: true, validationMessage: "" };
    }
    return { isValid: false, validationMessage: "" };
  }, [activeTab, tourDate, transferDate, pickupDate, returnDate]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();

    if (activeTab === "tour") {
      if (tourDate) params.set("date", format(tourDate, "yyyy-MM-dd"));
      params.set("adults", tourAdults.toString());
      params.set("children", tourChildren.toString());
      params.set("infants", tourInfants.toString()); // NEW
      params.set("pets", tourPets.toString());    // NEW
      params.set("guests", (tourAdults + tourChildren).toString()); // capacity guests only
      params.set("time", tourTime);

      updateDraft({
        date: tourDate ? format(tourDate, "yyyy-MM-dd") : "",
        startTime: tourTime,
        adultPax: tourAdults,
        childPax: tourChildren,
        infantPax: tourInfants,  // NEW
        petPax: tourPets,     // NEW
      });

      setLocation(
        selectedProductId
          ? `/tours/${selectedProductId}?${params}`
          : `/tours?${params}`
      );
      return;
    }

    if (activeTab === "transfer") {
      if (transferDate) params.set("date", format(transferDate, "yyyy-MM-dd"));
      params.set("time", transferTime);
      params.set("adults", transferAdults.toString());
      params.set("children", transferChildren.toString());
      params.set("infants", transferInfants.toString()); // NEW
      params.set("pets", transferPets.toString());    // NEW
      params.set("guests", (transferAdults + transferChildren).toString());
      if (transferFrom) params.set("from", transferFrom);
      if (transferTo) params.set("to", transferTo);

      updateDraft({
        date: transferDate ? format(transferDate, "yyyy-MM-dd") : "",
        startTime: transferTime,
        adultPax: transferAdults,
        childPax: transferChildren,
        infantPax: transferInfants,  // NEW
        petPax: transferPets,     // NEW
      });

      setLocation(
        selectedProductId
          ? `/transfers/${selectedProductId}?${params}`
          : `/transfers?${params}`
      );
      return;
    }

    if (activeTab === "vehicle") {
      if (pickupDate) {
        params.set("pickup", format(pickupDate, "yyyy-MM-dd"));
        params.set("date", format(pickupDate, "yyyy-MM-dd"));
      }
      if (returnDate) params.set("return", format(returnDate, "yyyy-MM-dd"));
      params.set("pickupTime", pickupTime);
      params.set("returnTime", returnTime);
      params.set("days", hireDays.toString());

      updateDraft({
        date: pickupDate ? format(pickupDate, "yyyy-MM-dd") : "",
        startTime: pickupTime,
        endTime: returnTime,
        adultPax: hireDays,
        childPax: 0,
        infantPax: 0,
        petPax: 0,
      });

      setLocation(
        selectedProductId
          ? `/vehicles/${selectedProductId}?${params}`
          : `/vehicles?${params}`
      );
      return;
    }

    setLocation("/tours");
  }, [
    activeTab,
    tourDate, tourTime, tourAdults, tourChildren, tourInfants, tourPets,
    transferFrom, transferTo, transferDate, transferTime, transferAdults, transferChildren, transferInfants, transferPets,
    pickupDate, pickupTime, returnDate, returnTime, hireDays,
    selectedProductId,
    updateDraft,
    setLocation,
  ]);

  // ── Return ────────────────────────────────────────────────────────────────
  return {
    activeTab,
    setActiveTab: handleSetActiveTab,

    tour: { date: tourDate, time: tourTime, adults: tourAdults, children: tourChildren, infants: tourInfants, pets: tourPets },
    setTourDate,
    setTourTime,
    setTourAdults,
    setTourChildren,
    setTourInfants,  // NEW
    setTourPets,     // NEW

    transfer: { from: transferFrom, to: transferTo, date: transferDate, time: transferTime, adults: transferAdults, children: transferChildren, infants: transferInfants, pets: transferPets },
    setTransferFrom,
    setTransferTo,
    setTransferDate,
    setTransferTime,
    setTransferAdults,
    setTransferChildren,
    setTransferInfants,  // NEW
    setTransferPets,     // NEW

    vehicle: { pickupDate, pickupTime, returnDate, returnTime },
    setPickupDate,
    setPickupTime,
    setReturnDate,
    setReturnTime,

    allProducts,
    tours,
    transfers,
    vehicles,
    isLoadingProducts,
    selectedProductId,
    setSelectedProductId,

    hireDays,
    tourGuestSummary,
    transferPassengerSummary,

    isValid,
    validationMessage,
    handleSearch,
  };
}
