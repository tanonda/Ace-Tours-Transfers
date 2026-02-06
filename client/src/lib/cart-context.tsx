import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { calculateLineTotal, type ProductCategory } from "./product.types";

const CART_STORAGE_KEY = 'ace-tours-cart';
const CART_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CartItem {
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
}

interface PersistedCart {
  items: CartItem[];
  timestamp: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeFromCart: (id: string, date?: Date, slot?: string) => void;
  updateCartItem: (id: string, updates: Partial<CartItem>, date?: Date, slot?: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
  isHydrated: boolean;
  expiresAt: number | null;
  isExpiringSoon: boolean;
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
    if (isHydrated && items.length > 0) {
      saveCartToStorage(items);
      // Update expiry to 24 hours from now when cart changes
      setExpiresAt(Date.now() + CART_EXPIRY_MS);
    }
  }, [items, isHydrated]);

  // Check if cart is expiring soon (< 1 hour remaining)
  const EXPIRY_WARNING_THRESHOLD = 60 * 60 * 1000; // 1 hour
  const isExpiringSoon = expiresAt !== null && (expiresAt - Date.now() < EXPIRY_WARNING_THRESHOLD) && items.length > 0;

  const addToCart = useCallback((item: Omit<CartItem, "quantity"> & { quantity?: number }) => {
    setItems((prev) => {
      // Multi-Product Booking Enabled
      const existing = prev.find((i) =>
        i.id === item.id &&
        i.date?.getTime() === item.date?.getTime() &&
        i.slot === item.slot
      );

      if (existing) {
        return prev.map((i) =>
          (i.id === item.id && i.date?.getTime() === item.date?.getTime() && i.slot === item.slot)
            ? {
              ...i,
              quantity: i.quantity + (item.quantity || 1),
              adultPax: i.adultPax + item.adultPax,
              childPax: i.childPax + item.childPax
            }
            : i
        );
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }];
    });

    toast({
      title: "Added to Cart",
      description: `${item.title} has been added to your booking list.`,
    });
  }, [toast]);

  const removeFromCart = useCallback((id: string, date?: Date, slot?: string) => {
    setItems((prev) => prev.filter((i) =>
      !(i.id === id && i.date?.getTime() === date?.getTime() && i.slot === slot)
    ));
  }, []);

  const updateCartItem = useCallback((id: string, updates: Partial<CartItem>, date?: Date, slot?: string) => {
    setItems((prev) => prev.map((i) =>
      (i.id === id && i.date?.getTime() === date?.getTime() && i.slot === slot)
        ? { ...i, ...updates }
        : i
    ));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  // Note: This total is a client-side estimation. Server-side PriceResolver is the source of truth.
  const total = items.reduce((acc, item) =>
    acc + calculateLineTotal(item.price, item.childPrice, item.adultPax, item.childPax)
    , 0);
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
      isExpiringSoon
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

