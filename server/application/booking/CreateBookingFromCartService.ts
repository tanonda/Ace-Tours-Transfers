import { db } from "../../db.js";
import { IStorage } from "../../storage.js";
import { Cart } from "../../domain/booking/Cart.js";
import { Booking } from "../../domain/booking/Booking.js";
import { PriceCartService } from "../pricing/PriceCartService.js";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { BookingCreated } from "../../domain/events.js";
import { PricingEngine } from "../../domain/pricing/PricingEngine.js";
import { config } from "../../config.js";
import { AvailabilityApplicationService } from "../availability/availability.application-service.js";
import { metricsService } from "../../infrastructure/metrics/metrics.service.js";

export interface CreateBookingRequest {
  customerName: string;
  customerEmail: string;
  sessionId?: string;
  idempotencyKey?: string;
  items: {
    productId: string;
    adultPax: number;
    childPax: number;
    date: string;
    slot?: string;
    quantity?: number;
    startTime?: string;
    endTime?: string;
  }[];
}

export class CreateBookingFromCartService {
  private priceCartService: PriceCartService;
  private pricingEngine: PricingEngine;
  private availabilityService: AvailabilityApplicationService;

  constructor(private storage: IStorage) {
    this.priceCartService = new PriceCartService(storage);
    this.pricingEngine = new PricingEngine(storage);
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

        const rates = await this.pricingEngine.getTourRate(item.productId, item.date);
        if (!rates) throw new Error(`Rates for product ${item.productId} not found`);

        // ATOMIC AVAILABILITY LOCKING
        const totalQuantity = item.adultPax + item.childPax;
        if (totalQuantity > 0) {
          const isVehicle = product.category === 'vehicle';
          const duration = isVehicle ? (item.quantity || 1) : 1;

          if (isVehicle && duration > 1) {
            // Phase 1: Multi-day resource consistency - find a vehicle free for ALL days
            const availableResources = await this.storage.getAvailableResourcesMultiDay(product.id, item.date, duration);
            if (availableResources.length === 0) {
              throw new Error(`No single ${product.title} unit available for the entire period ${item.date} to ${duration} days.`);
            }
            const pinnedResourceId = availableResources[0].id;

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
                sessionId: cartId,
                startTime: item.startTime,
                endTime: item.endTime,
                pinnedResourceId
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
              sessionId: cartId,
              startTime: item.startTime,
              endTime: item.endTime
            });
            createdHolds.push(hold.id);
          }
        }

        // Phase 2B: Server-side price recalculation using PricingEngine
        const pricing = await this.pricingEngine.calculateLineItem(
          item.adultPax,
          item.childPax,
          rates,
          item.date
        );

        let serverPricedTotalCents = pricing.breakdown.finalTotalCents;

        // If it's a vehicle (or any duration-based product), multiply by quantity (days)
        const duration = (product.category === 'vehicle') ? (item.quantity || 1) : 1;
        serverPricedTotalCents *= duration;

        const subtotalCents = serverPricedTotalCents;
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

      // Phase 8: Metrics
      metricsService.incrementFailure(error instanceof Error ? error.message : "unknown_error");

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
    const bookingId = `book_${crypto.randomUUID()}`;
    const booking = Booking.createFromCart(bookingId, cart, {
      name: request.customerName,
      email: request.customerEmail
    });

    // 4. Persist (Mapping Domain object to DB schema) inside a transaction
    return await db.transaction(async (tx) => {
      // Compute aggregate start/end for the booking (earliest start, latest end among items)
      let aggregateStart: string | null = null;
      let aggregateEnd: string | null = null;
      for (const it of request.items) {
        if (it.startTime) {
          if (!aggregateStart || it.startTime < aggregateStart) aggregateStart = it.startTime;
        }
        if (it.endTime) {
          if (!aggregateEnd || it.endTime > aggregateEnd) aggregateEnd = it.endTime;
        }
      }

      const persistedBooking = await this.storage.createBooking({
        id: booking.id,
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
        bookingSessionId: cartId,
        idempotencyKey: request.idempotencyKey || null,
        startTime: aggregateStart,
        endTime: aggregateEnd
      }, tx);

      // Persist all items
      for (const item of cart.getItems()) {
        await this.storage.createBookingItem({
          bookingId: persistedBooking.id,
          productId: item.productId,
          productName: item.name,
          productType: item.productType,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          subtotalCents: item.unitPriceCents * item.quantity,
          adultPax: item.adultPax,
          childPax: item.childPax
        }, tx);
      }

      // 5. Emit Event (inside tx to ensure it only happens if DB success, though ideally outside or via outbox)
      await eventDispatcher.dispatch(new BookingCreated(booking.id, booking.amountCents));

      return booking;
    });
  }
}
