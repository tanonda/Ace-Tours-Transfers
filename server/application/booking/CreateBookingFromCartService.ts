
import { IStorage } from "../../storage.js";
import { Cart, CartLineItem } from "../../domain/booking/Cart.js";
import { Booking } from "../../domain/booking/Booking.js";
import { PriceCartService } from "../pricing/PriceCartService.js";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { BookingCreated } from "../../domain/events.js";
import { PricingService } from "../../domain/pricing/PricingService.js";
import { config } from "../../config.js";

export interface CreateBookingRequest {
  customerName: string;
  customerEmail: string;
  items: { productId: string; quantity: number; date: string; slot?: string }[];
}

export class CreateBookingFromCartService {
  private priceCartService: PriceCartService;

  constructor(private storage: IStorage) {
    this.priceCartService = new PriceCartService(storage);
  }

  async execute(request: CreateBookingRequest): Promise<Booking> {
    if (config.killSwitches.bookingsPaused) {
      throw new Error("CRITICAL: Booking systems are currently paused for maintenance.");
    }

    const cartId = `cart_${Date.now()}`;
    const cart = new Cart(cartId);

    // 1. Build Cart items and add to aggregate
    for (const item of request.items) {
      const product = await this.storage.getTour(item.productId);
      if (!product) throw new Error(`Product ${item.productId} not found`);
      
      cart.addItem({
        productId: product.id,
        name: product.title,
        unitPrice: parseFloat(product.price.replace(/[^0-9.]/g, '')),
        quantity: item.quantity,
        date: item.date,
        slot: item.slot
      });
    }

    // 2. Price the Cart via Pricing Context
    const snapshot = await this.priceCartService.priceCart(cartId, request.items);
    cart.setPricedSnapshot(snapshot);

    // 3. Create Booking Aggregate
    const bookingId = `book_${Date.now()}`;
    const booking = Booking.createFromCart(bookingId, cart, {
      name: request.customerName,
      email: request.customerEmail
    });

    // 4. Persist (Mapping Domain object to DB schema)
    // In a real system, we'd have a Repository. Here we update storage.
    // NOTE: This uses the existing storage methods for now but logically it's a new domain flow.
    await this.storage.createBooking({
      id: booking.id,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      amount: PricingService.formatTotal(booking.amount),
      status: 'pending', // Maps to BookingStatus.CREATED in DB for now
      date: request.items[0].date, // Simplified for single-item cart assumption
      guests: request.items[0].quantity,
      tourId: request.items[0].productId,
      tourName: cart.getItems()[0].name,
      createdAt: new Date()
    } as any);

    // 5. Emit Event
    await eventDispatcher.dispatch(new BookingCreated(booking.id, booking.amount));

    return booking;
  }
}
