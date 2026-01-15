import React, { createContext, useContext, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export interface CartItem {
  id: string;
  title: string;
  price: number; // For display, usually adult price
  image: string;
  quantity: number;
  date?: Date;
  adultPax: number;
  childPax: number;
  slot?: string;
  type: "tour" | "transfer" | "vehicle";
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  removeFromCart: (id: string, date?: Date, slot?: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const addToCart = (item: Omit<CartItem, "quantity">) => {
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
                quantity: i.quantity + 1,
                adultPax: i.adultPax + item.adultPax,
                childPax: i.childPax + item.childPax
              }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    
    toast({
      title: "Added to Cart",
      description: `${item.title} has been added to your booking list.`,
    });
  };

  const removeFromCart = (id: string, date?: Date, slot?: string) => {
    setItems((prev) => prev.filter((i) => 
      !(i.id === id && i.date?.getTime() === date?.getTime() && i.slot === slot)
    ));
  };

  const clearCart = () => {
    setItems([]);
  };

  // Note: This total is a client-side estimation. Server-side PriceResolver is the truth.
  const total = items.reduce((acc, item) => acc + (item.price * item.adultPax), 0);
  const itemCount = items.length;

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, clearCart, total, itemCount }}>
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
