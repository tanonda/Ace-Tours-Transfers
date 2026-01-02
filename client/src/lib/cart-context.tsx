import React, { createContext, useContext, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export interface CartItem {
  id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
  date?: Date;
  guests?: number;
  type: "tour" | "transfer" | "vehicle";
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  removeFromCart: (id: string) => void;
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
      // PRODUCTION GUARD: Single-item cart enforcement for launch
      if (prev.length > 0 && !(prev[0].id === item.id && prev[0].date === item.date)) {
        toast({
          title: "Cart Limit",
          description: "For the best service, please book one tour at a time. Finish your current booking to add another.",
          variant: "destructive"
        });
        return prev;
      }

      const existing = prev.find((i) => i.id === item.id && i.date === item.date);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id && i.date === item.date
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    
    // Only show success toast if the item was actually added (or updated)
    // Using a simpler approach here: if we have more than 0 items and it's not the same one, we already toasted.
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = () => {
    setItems([]);
  };

  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

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
