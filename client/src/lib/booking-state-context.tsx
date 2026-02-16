/**
 * Booking State Context
 * 
 * Centralized state management for booking draft data across views.
 * Solves the problem of isolated local state in detail pages that resets on navigation.
 * 
 * USAGE:
 * - Wrap app with <BookingStateProvider>
 * - Use useBookingDraft() to get/set draft booking values
 * - Use usePrefillFromCart(productId) to prefill from existing cart items
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useCart } from "./cart-context";

const DRAFT_STORAGE_KEY = 'ace-tours-booking-draft';

export interface BookingDraft {
    productId: string;
    adultPax: number;
    childPax: number;
    date: string; // ISO date string or empty
    slot?: string;
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
    date: "",
};

const BookingStateContext = createContext<BookingStateContextType | undefined>(undefined);

/**
 * Load booking draft from localStorage
 */
function loadDraftFromStorage(): BookingDraft | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (!stored) return null;
        return JSON.parse(stored);
    } catch (error) {
        console.warn('[BookingState] Failed to load draft from storage:', error);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return null;
    }
}

/**
 * Save booking draft to localStorage
 */
function saveDraftToStorage(draft: BookingDraft | null): void {
    if (typeof window === 'undefined') return;

    try {
        if (draft && draft.productId) {
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        } else {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
    } catch (error) {
        console.warn('[BookingState] Failed to save draft to storage:', error);
    }
}

export function BookingStateProvider({ children }: { children: React.ReactNode }) {
    const [draft, setDraftState] = useState<BookingDraft | null>(null);

    // Hydrate from localStorage on mount
    useEffect(() => {
        const storedDraft = loadDraftFromStorage();
        if (storedDraft) {
            setDraftState(storedDraft);
        }
    }, []);

    // Persist to localStorage on change
    useEffect(() => {
        saveDraftToStorage(draft);
    }, [draft]);

    const setDraft = useCallback((newDraft: BookingDraft | null) => {
        setDraftState(newDraft);
    }, []);

    const updateDraft = useCallback((updates: Partial<BookingDraft>) => {
        setDraftState(prev => {
            const current = prev || defaultDraft;
            const hasChanges = Object.entries(updates).some(([key, value]) => {
                return current[key as keyof BookingDraft] !== value;
            });

            if (!hasChanges) return prev;
            return { ...current, ...updates };
        });
    }, []);

    const clearDraft = useCallback(() => {
        setDraftState(null);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
    }, []);

    const getDraftForProduct = useCallback((productId: string): BookingDraft | null => {
        if (draft && draft.productId === productId) {
            return draft;
        }
        return null;
    }, [draft]);

    return (
        <BookingStateContext.Provider value={{
            draft,
            setDraft,
            updateDraft,
            clearDraft,
            getDraftForProduct
        }}>
            {children}
        </BookingStateContext.Provider>
    );
}

/**
 * Hook to access and update booking draft state
 */
export function useBookingDraft() {
    const context = useContext(BookingStateContext);
    if (context === undefined) {
        throw new Error("useBookingDraft must be used within a BookingStateProvider");
    }
    return context;
}

/**
 * Hook to prefill booking draft from an existing cart item
 * Returns the prefilled values if found, or defaults if not
 */
export function usePrefillFromCart(productId: string): BookingDraft {
    const { items } = useCart();
    const { draft, getDraftForProduct } = useBookingDraft();

    // Priority: 1) Existing draft for this product, 2) Cart item, 3) Defaults
    const existingDraft = getDraftForProduct(productId);
    if (existingDraft) {
        return existingDraft;
    }

    // Check if product exists in cart
    const cartItem = items.find(item => item.id === productId);
    if (cartItem) {
        return {
            productId,
            adultPax: cartItem.adultPax,
            childPax: cartItem.childPax,
            date: cartItem.date ? (cartItem.date instanceof Date ? cartItem.date.toISOString().split('T')[0] : new Date(cartItem.date).toISOString().split('T')[0]) : "",
            slot: cartItem.slot,
        };
    }

    // Return defaults
    return {
        productId,
        adultPax: 2,
        childPax: 0,
        date: "",
    };
}
