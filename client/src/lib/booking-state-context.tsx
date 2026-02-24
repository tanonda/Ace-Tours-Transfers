/**
 * Booking State Context — updated for infant + pet pax
 *
 * Centralized state management for booking draft data across views.
 * Adds infantPax and petPax to the BookingDraft interface.
 * Both fields default to 0 and do not affect pricing.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useCart } from "./cart-context";

const DRAFT_STORAGE_KEY = "ace-tours-booking-draft";

export interface BookingDraft {
  productId: string;
  adultPax: number;
  childPax: number;
  infantPax: number;  // NEW — infants under 2, manifesting only
  petPax: number;     // NEW — pets, manifesting only
  date: string;       // ISO date string or empty
  slot?: string;
  startTime?: string;
  endTime?: string;
}

interface BookingStateContextType {
  draft: BookingDraft | null;
  setDraft: (draft: BookingDraft | null) => void;
  updateDraft: (updates: Partial<BookingDraft>) => void;
  clearDraft: () => void;
  getDraftForProduct: (productId: string) => BookingDraft | null;
}

const defaultDraft: BookingDraft = {
  productId: "",
  adultPax: 2,
  childPax: 0,
  infantPax: 0, // NEW
  petPax: 0,    // NEW
  date: "",
};

const BookingStateContext = createContext<BookingStateContextType | undefined>(undefined);

function loadDraftFromStorage(): BookingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Backfill new fields for drafts saved before this update
    return {
      ...parsed,
      infantPax: parsed.infantPax ?? 0,
      petPax: parsed.petPax ?? 0,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
    };
  } catch (error) {
    console.warn("[BookingState] Failed to load draft from storage:", error);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

function saveDraftToStorage(draft: BookingDraft | null): void {
  if (typeof window === "undefined") return;
  try {
    if (draft && draft.productId) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } else {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("[BookingState] Failed to save draft to storage:", error);
  }
}

export function BookingStateProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraftState] = useState<BookingDraft | null>(null);

  useEffect(() => {
    const storedDraft = loadDraftFromStorage();
    if (storedDraft) setDraftState(storedDraft);
  }, []);

  useEffect(() => {
    saveDraftToStorage(draft);
  }, [draft]);

  const setDraft = useCallback((newDraft: BookingDraft | null) => {
    setDraftState(newDraft);
  }, []);

  const updateDraft = useCallback((updates: Partial<BookingDraft>) => {
    setDraftState((prev) => {
      const current = prev || defaultDraft;
      const hasChanges = Object.entries(updates).some(
        ([key, value]) => current[key as keyof BookingDraft] !== value
      );
      if (!hasChanges) return prev;
      return { ...current, ...updates };
    });
  }, []);

  const clearDraft = useCallback(() => {
    setDraftState(null);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }, []);

  const getDraftForProduct = useCallback(
    (productId: string): BookingDraft | null => {
      if (draft && draft.productId === productId) return draft;
      return null;
    },
    [draft]
  );

  return (
    <BookingStateContext.Provider
      value={{ draft, setDraft, updateDraft, clearDraft, getDraftForProduct }}
    >
      {children}
    </BookingStateContext.Provider>
  );
}

export function useBookingDraft() {
  const context = useContext(BookingStateContext);
  if (context === undefined) {
    throw new Error("useBookingDraft must be used within a BookingStateProvider");
  }
  return context;
}

export function usePrefillFromCart(productId: string): BookingDraft {
  const { items } = useCart();
  const { draft, getDraftForProduct } = useBookingDraft();

  const existingDraft = getDraftForProduct(productId);
  if (existingDraft) return existingDraft;

  const cartItem = items.find((item) => item.id === productId);
  if (cartItem) {
    return {
      productId,
      adultPax: cartItem.adultPax,
      childPax: cartItem.childPax,
      infantPax: (cartItem as any).infantPax ?? 0,  // backfill from cart if present
      petPax: (cartItem as any).petPax ?? 0,
      date: cartItem.date
        ? cartItem.date instanceof Date
          ? cartItem.date.toISOString().split("T")[0]
          : new Date(cartItem.date).toISOString().split("T")[0]
        : "",
      slot: cartItem.slot,
      startTime: cartItem.startTime,
      endTime: cartItem.endTime,
    };
  }

  return {
    productId,
    adultPax: 2,
    childPax: 0,
    infantPax: 0,
    petPax: 0,
    date: "",
  };
}
