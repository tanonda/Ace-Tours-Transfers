import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { type ProductCategory } from "./product.types";
import { fetchPricing, type PricingSnapshot } from "./api";

const CART_STORAGE_KEY = 'ace-tours-cart';
const CART_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CartItem {
  cartItemId: string;    // Unique identifier for the cart item entry
  id: string;
  title: string;
  price: number;         // adultPriceCents
  childPrice: number;    // childPriceCents
  image: string;
  quantity: number;
  date?: Date;
  adultPax: number;
  childPax: number;
  slot?: string;
  type: ProductCategory;
  addonIds?: string[];
  addonTotal?: number;
  startTime?: string;
  endTime?: string;
}

interface PersistedCart {
  items: CartItem[];
  timestamp: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity" | "cartItemId"> & { quantity?: number }) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartItem: (cartItemId: string, updates: Partial<CartItem>) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
  isHydrated: boolean;
  expiresAt: number | null;
  isExpiringSoon: boolean;
  pricingSnapshot: PricingSnapshot | null;
  isLoadingPricing: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Helper to safely parse stored cart with date revival
function loadCartFromStorage(): { items: CartItem[]; expiresAt: number | null } {
  if (typeof window === 'undefined') return { items: [], expiresAt: null };

  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return { items: [], expiresAt: null };

    const parsed: PersistedCart = JSON.parse(stored);
    const expiresAt = parsed.timestamp + CART_EXPIRY_MS;

    // Check expiry - clear if older than 24 hours
    if (Date.now() > expiresAt) {
      localStorage.removeItem(CART_STORAGE_KEY);
      return { items: [], expiresAt: null };
    }

    // Revive Date objects from ISO strings
    const items = parsed.items.map(item => ({
      ...item,
      date: item.date ? new Date(item.date) : undefined,
    }));

    return { items, expiresAt };
  } catch (error) {
    console.warn('[Cart] Failed to load cart from storage:', error);
    localStorage.removeItem(CART_STORAGE_KEY);
    return { items: [], expiresAt: null };
  }
}

function saveCartToStorage(items: CartItem[]): void {
  if (typeof window === 'undefined') return;

  try {
    const payload: PersistedCart = {
      items,
      timestamp: Date.now(),
    };
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[Cart] Failed to save cart to storage:', error);
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  // Initialize with empty array, hydrate from storage in useEffect
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [pricingSnapshot, setPricingSnapshot] = useState<PricingSnapshot | null>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(false);
  const { toast } = useToast();

  // Hydrate cart from localStorage on mount
  useEffect(() => {
    const stored = loadCartFromStorage();
    if (stored.items.length > 0) {
      setItems(stored.items);
      setExpiresAt(stored.expiresAt);
    }
    setIsHydrated(true);
  }, []);

  // Persist cart to localStorage whenever items change (after hydration)
  useEffect(() => {
    if (isHydrated) {
      saveCartToStorage(items);
      if (items.length > 0) {
        // Update expiry to 24 hours from now when cart changes
        setExpiresAt(Date.now() + CART_EXPIRY_MS);
      }
    }
  }, [items, isHydrated]);

  // Check if cart is expiring soon (< 1 hour remaining)
  const EXPIRY_WARNING_THRESHOLD = 60 * 60 * 1000; // 1 hour
  const isExpiringSoon = expiresAt !== null && (expiresAt - Date.now() < EXPIRY_WARNING_THRESHOLD) && items.length > 0;

  // Helper to safely compare dates which might be Date objects or ISO strings
  const areDatesEqual = (d1?: Date | string, d2?: Date | string) => {
    if (!d1 && !d2) return true;
    if (!d1 || !d2) return false;
    try {
      const t1 = d1 instanceof Date ? d1.getTime() : new Date(d1).getTime();
      const t2 = d2 instanceof Date ? d2.getTime() : new Date(d2).getTime();
      return t1 === t2;
    } catch (e) {
      return false;
    }
  };

  const addToCart = useCallback((item: Omit<CartItem, "quantity" | "cartItemId"> & { quantity?: number }) => {
    setItems((prev) => {
      // Multi-Product Booking Enabled
      // We group items that are identical across these specific criteria
      const existingIndex = prev.findIndex((i) =>
        i.id === item.id &&
        areDatesEqual(i.date, item.date) &&
        i.slot === item.slot &&
        i.startTime === item.startTime &&
        i.endTime === item.endTime &&
        JSON.stringify(i.addonIds || []) === JSON.stringify(item.addonIds || [])
      );

      if (existingIndex !== -1) {
        const updatedItems = [...prev];
        const existing = updatedItems[existingIndex];
        updatedItems[existingIndex] = {
          ...existing,
          quantity: existing.quantity + (item.quantity || 1),
          adultPax: existing.adultPax + item.adultPax,
          childPax: existing.childPax + item.childPax
        };
        return updatedItems;
      }

      // Generate a unique ID for this new cart entry
      const cartItemId = `${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return [...prev, { ...item, cartItemId, quantity: item.quantity || 1 }];
    });

    toast({
      title: "Added to Cart",
      description: `${item.title} has been added to your booking list.`,
    });
  }, [toast]);

  const removeFromCart = useCallback((cartItemId: string) => {
    setItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  }, []);

  const updateCartItem = useCallback((cartItemId: string, updates: Partial<CartItem>) => {
    setItems((prev) => prev.map((i) =>
      (i.cartItemId === cartItemId) ? { ...i, ...updates } : i
    ));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  // Fetch backend pricing whenever items change (Phase 2C)
  // PricingEngine (backend) is the single source of truth
  useEffect(() => {
    if (!isHydrated || items.length === 0) {
      setPricingSnapshot(null);
      return;
    }

    async function updatePricing() {
      setIsLoadingPricing(true);
      try {
        const snapshot = await fetchPricing({
          items: items.map(item => ({
            productId: item.id,
            adultPax: item.adultPax,
            childPax: item.childPax,
            quantity: item.quantity,
            addonIds: item.addonIds || [],
            date: item.date ? item.date.toISOString().split('T')[0] : undefined,
            startTime: item.startTime,
            endTime: item.endTime,
          })),
        });
        setPricingSnapshot(snapshot);
      } catch (error) {
        console.error('[Cart] Failed to fetch backend pricing:', error);
        // Fallback to client-side estimation (deprecated)
        toast({
          title: "Pricing Service Unavailable",
          description: "Using estimated pricing. Actual price will be confirmed at checkout.",
          variant: "default"
        });
      } finally {
        setIsLoadingPricing(false);
      }
    }

    updatePricing();
  }, [items, isHydrated, toast]);

  // Use backend pricing if available. Backend PricingEngine is the absolute source of truth.
  // We no longer perform client-side estimation to prevent invariant drift.
  const total = pricingSnapshot?.totalCents ?? 0;
  const itemCount = items.length;

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateCartItem,
      clearCart,
      total,
      itemCount,
      isHydrated,
      expiresAt,
      isExpiringSoon,
      pricingSnapshot,
      isLoadingPricing,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

