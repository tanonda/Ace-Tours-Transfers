
import { IStorage } from "../../storage.js";
import { Cart } from "../../domain/booking/Cart.js";
import { Booking } from "../../domain/booking/Booking.js";
import { PriceCartService } from "../pricing/PriceCartService.js";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { BookingCreated } from "../../domain/events.js";
import { PriceResolver } from "../../domain/pricing/PriceResolver.js";
import { config } from "../../config.js";

export interface CreateBookingRequest {
  customerName: string;
  customerEmail: string;
  items: { 
    productId: string; 
    adultPax: number; 
    childPax: number; 
    date: string; 
    slot?: string 
  }[];
}

export class CreateBookingFromCartService {
  private priceCartService: PriceCartService;
  private priceResolver: PriceResolver;

  constructor(private storage: IStorage) {
    this.priceCartService = new PriceCartService(storage);
    this.priceResolver = new PriceResolver(storage);
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
      
      const rates = await this.priceResolver.getTourRate(item.productId);
      if (!rates) throw new Error(`Rates for product ${item.productId} not found`);

      const subtotalCents = this.priceResolver.calculateItemTotal(item.adultPax, item.childPax, rates);
      const totalPax = item.adultPax + item.childPax;
      const unitPriceCents = totalPax > 0 ? Math.round(subtotalCents / totalPax) : 0;

      cart.addItem({
        productId: product.id,
        name: product.title,
        unitPriceCents: unitPriceCents,
        quantity: totalPax,
        adultPax: item.adultPax,
        childPax: item.childPax,
        date: item.date,
        slot: item.slot,
        productType: product.category
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
    await this.storage.createBooking({
      id: booking.id,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      amount: snapshot.totalCents.toString(), // Legacy support but we use numeric field too
      totalAmountCents: snapshot.totalCents,
      status: 'pending',
      date: request.items[0].date,
      guests: request.items.reduce((sum, i) => sum + i.adultPax + i.childPax, 0),
      tourId: request.items[0].productId,
      tourName: cart.getItems()[0].name,
      adultPaxTotal: request.items.reduce((sum, i) => sum + i.adultPax, 0),
      childPaxTotal: request.items.reduce((sum, i) => sum + i.childPax, 0),
      createdAt: new Date()
    });

    // Persist all items
    for (const item of cart.getItems()) {
      await this.storage.createBookingItem({
        id: `bi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        bookingId: booking.id,
        productId: item.productId,
        productName: item.name,
        productType: item.productType,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        subtotalCents: item.unitPriceCents * item.quantity, // Simplification, in reality use PriceResolver logic per item
        adultPax: item.adultPax,
        childPax: item.childPax,
        createdAt: new Date()
      });
    }

    // 5. Emit Event
    await eventDispatcher.dispatch(new BookingCreated(booking.id, booking.amountCents));

    return booking;
  }
}
