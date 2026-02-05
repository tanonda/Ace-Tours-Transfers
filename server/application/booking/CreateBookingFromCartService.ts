
import { IStorage } from "../../storage.js";
import { Cart } from "../../domain/booking/Cart.js";
import { Booking } from "../../domain/booking/Booking.js";
import { PriceCartService } from "../pricing/PriceCartService.js";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { BookingCreated } from "../../domain/events.js";
import { PriceResolver } from "../../domain/pricing/PriceResolver.js";
import { config } from "../../config.js";
import { AvailabilityApplicationService } from "../availability/availability.application-service.js";
export interface CreateBookingRequest {
  customerName: string;
  customerEmail: string;
  sessionId?: string;
  items: { 
    productId: string; 
    adultPax: number; 
    childPax: number; 
    date: string; 
    slot?: string;
    quantity?: number;
  }[];
}

export class CreateBookingFromCartService {
  private priceCartService: PriceCartService;
  private priceResolver: PriceResolver;
  private availabilityService: AvailabilityApplicationService;

  constructor(private storage: IStorage) {
    this.priceCartService = new PriceCartService(storage);
    this.priceResolver = new PriceResolver(storage);
    this.availabilityService = new AvailabilityApplicationService(storage);
  }

  async execute(request: CreateBookingRequest): Promise<Booking> {
    if (config.killSwitches.bookingsPaused) {
      throw new Error("CRITICAL: Booking systems are currently paused for maintenance.");
    }

    const cartId = request.sessionId || `cart_${Date.now()}`;
    const cart = new Cart(cartId);
    const createdHolds: string[] = [];

    try {
      // 1. Build Cart items and add to aggregate
      for (const item of request.items) {
        const product = await this.storage.getTour(item.productId);
        if (!product) throw new Error(`Product ${item.productId} not found`);
        
        const rates = await this.priceResolver.getTourRate(item.productId);
        if (!rates) throw new Error(`Rates for product ${item.productId} not found`);

        // ATOMIC AVAILABILITY LOCKING
        const totalQuantity = item.adultPax + item.childPax;
        if (totalQuantity > 0) {
          const isVehicle = product.category === 'vehicle';
          const duration = isVehicle ? (item.quantity || 1) : 1;

          if (isVehicle && duration > 1) {
            // Multi-day lock for vehicles
            const startDate = new Date(item.date);
            for (let d = 0; d < duration; d++) {
              const currentDate = new Date(startDate);
              currentDate.setDate(startDate.getDate() + d);
              const dateStr = currentDate.toISOString().split('T')[0];
              
              const hold = await this.availabilityService.createHold({
                tourId: product.id,
                date: dateStr,
                slot: item.slot,
                quantity: totalQuantity,
                sessionId: cartId
              });
              createdHolds.push(hold.id);
            }
          } else {
            // Single day lock
            const hold = await this.availabilityService.createHold({
              tourId: product.id,
              date: item.date,
              slot: item.slot,
              quantity: totalQuantity,
              sessionId: cartId
            });
            createdHolds.push(hold.id);
          }
        }

        const subtotalCents = this.priceResolver.calculateItemTotal(item.adultPax, item.childPax, rates);
        const unitPriceCents = totalQuantity > 0 ? Math.round(subtotalCents / totalQuantity) : 0;

        cart.addItem({
          productId: product.id,
          name: product.title,
          unitPriceCents: unitPriceCents,
          quantity: totalQuantity,
          adultPax: item.adultPax,
          childPax: item.childPax,
          date: item.date,
          slot: item.slot,
          productType: product.category
        });
      }
    } catch (error) {
      // ROLLBACK: Release any holds created if one fails
      console.error("[AVAILABILITY] Hold creation failed, rolling back holds:", createdHolds);
      for (const holdId of createdHolds) {
        await this.availabilityService.releaseHold(holdId).catch(console.error);
      }
      throw error;
    }

    // 2. Price the Cart via Pricing Context
    const snapshot = await this.priceCartService.priceCart(cartId, request.items.map(i => ({
      productId: i.productId,
      adultPax: i.adultPax,
      childPax: i.childPax,
      quantity: i.quantity
    })));
    cart.setPricedSnapshot(snapshot);

    // 3. Create Booking Aggregate
    const bookingId = `book_${Date.now()}`;
    const booking = Booking.createFromCart(bookingId, cart, {
      name: request.customerName,
      email: request.customerEmail
    });

    // 4. Persist (Mapping Domain object to DB schema)
    await this.storage.createBooking({
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      amount: snapshot.totalCents.toString(), 
      totalAmountCents: snapshot.totalCents,
      status: 'pending',
      date: request.items[0].date,
      guests: request.items.reduce((sum, i) => sum + i.adultPax + i.childPax, 0),
      tourId: request.items[0].productId,
      tourName: cart.getItems()[0].name,
      adultPaxTotal: request.items.reduce((sum, i) => sum + i.adultPax, 0),
      childPaxTotal: request.items.reduce((sum, i) => sum + i.childPax, 0),
      holdId: createdHolds[0] || null, // Link primary hold (minimal corrective change)
      bookingSessionId: cartId
    });

    // Persist all items
    for (const item of cart.getItems()) {
      await this.storage.createBookingItem({
        bookingId: booking.id,
        productId: item.productId,
        productName: item.name,
        productType: item.productType,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        subtotalCents: item.unitPriceCents * item.quantity, // Simplification, in reality use PriceResolver logic per item
        adultPax: item.adultPax,
        childPax: item.childPax
      });
    }

    // 5. Emit Event
    await eventDispatcher.dispatch(new BookingCreated(booking.id, booking.amountCents));

    return booking;
  }
}
