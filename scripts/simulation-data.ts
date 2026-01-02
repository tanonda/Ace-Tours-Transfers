
import { Cart } from "../server/domain/booking/Cart";
import { Booking } from "../server/domain/booking/Booking";
import { PricingService } from "../server/domain/pricing/PricingService";
import { PaymentIntent } from "../server/domain/payments/PaymentIntent";

/**
 * Simulation Data Generator
 * Provides consistent mock objects for go-live verification.
 */

export const SimulationData = {
  guest: {
    name: "Verification Bot",
    email: "verify@acetours.vu",
    phone: "+678 555 9999"
  },

  createValidCart(id: string = "sim_cart_123"): Cart {
    const cart = new Cart(id);
    cart.addItem({
      productId: "tour_efate",
      name: "Efate Scenic Tour",
      unitPrice: 15000,
      quantity: 2,
      date: "2026-06-01"
    });
    
    const snapshot = PricingService.createSnapshot([
      { productId: "tour_efate", name: "Efate Scenic Tour", price: 15000, quantity: 2 }
    ]);
    cart.setPricedSnapshot(snapshot);
    return cart;
  },

  createEmptyCart(id: string = "sim_empty_cart"): Cart {
    return new Cart(id);
  },

  createBooking(id: string = "sim_book_123"): Booking {
    const cart = this.createValidCart();
    return Booking.createFromCart(id, cart, this.guest);
  }
};
