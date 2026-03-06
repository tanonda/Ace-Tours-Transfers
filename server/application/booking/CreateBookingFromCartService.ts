import { db } from "../../db.js";
import { IStorage } from "../../storage.js";
import { Cart } from "../../domain/booking/Cart.js";
import { Booking as DomainBooking } from "../../domain/booking/Booking.js";
import { Booking as SchemaBooking } from "../../../shared/schema.js";
import { PriceCartService } from "../pricing/PriceCartService.js";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { BookingCreated } from "../../domain/events.js";
import { PricingEngine } from "../../domain/pricing/PricingEngine.js";
import { config } from "../../config.js";
import { AvailabilityApplicationService } from "../availability/availability.application-service.js";
import { metricsService } from "../../infrastructure/metrics/metrics.service.js";
import crypto from "crypto";

export interface CreateBookingRequest {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  sessionId?: string;
  idempotencyKey?: string;
  pickupLocation?: string;
  items: {
    productId: string;
    adultPax: number;
    childPax: number;
    infantPax: number;    // NEW — infants under 2, no seat/pricing impact
    petPax: number;       // NEW — pets, manifesting only
    date: string;
    slot?: string;
    quantity?: number;
    addonIds?: string[];
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

  async execute(request: CreateBookingRequest): Promise<SchemaBooking> {
    if (config.killSwitches.bookingsPaused) {
      throw new Error("CRITICAL: Booking systems are currently paused for maintenance.");
    }

    const startTime = Date.now();

    const cartId = request.sessionId || `cart_${crypto.randomUUID()}`;
    const cart = new Cart(cartId);

    // Phase 4: Wrap EVERYTHING in a single atomic transaction
    return await db.transaction(async (tx) => {
      const createdHolds: string[] = [];

      try {
        // 1. Build Cart items and create holds ATOMICALLY
        for (const item of request.items) {
          const product = await this.storage.getProduct(item.productId);
          if (!product) throw new Error(`Product ${item.productId} not found`);

          const rates = await this.pricingEngine.getTourRate(item.productId, item.date);
          if (!rates) throw new Error(`Rates for product ${item.productId} not found`);

          // PRICING NOTE: Infants and pets do NOT count toward capacity or pricing.
          // Only adults and children consume seats / affect price.
          const totalPricedPax = item.adultPax + item.childPax;

          if (totalPricedPax > 0) {
            const isVehicle = product.category === "vehicle";
            const duration = isVehicle ? (item.quantity || 1) : 1;

            if (isVehicle && duration > 1) {
              // Multi-day consistency
              const availableResources = await this.storage.getAvailableResourcesMultiDay(
                product.id,
                item.date,
                duration
              );
              if (availableResources.length === 0) {
                throw new Error(
                  `No single ${product.title} unit available for the entire period ${item.date} to ${duration} days.`
                );
              }
              const pinnedResourceId = availableResources[0].id;
              const startDateParts = item.date.split("-").map(Number);
              const startDate = new Date(
                Date.UTC(startDateParts[0], startDateParts[1] - 1, startDateParts[2])
              );
              for (let d = 0; d < duration; d++) {
                const currentDate = new Date(startDate);
                currentDate.setUTCDate(startDate.getUTCDate() + d);
                const dateStr = currentDate.toISOString().split("T")[0];
                const hold = await this.availabilityService.createHold(
                  {
                    tourId: product.id,
                    date: dateStr,
                    slot: item.slot,
                    quantity: totalPricedPax,
                    sessionId: cartId,
                    startTime: item.startTime,
                    endTime: item.endTime,
                    pinnedResourceId,
                  },
                  tx
                );
                createdHolds.push(hold.id);
              }
            } else {
              // Single day lock — infants/pets do NOT consume capacity slots
              const hold = await this.availabilityService.createHold(
                {
                  tourId: product.id,
                  date: item.date,
                  slot: item.slot,
                  quantity: totalPricedPax, // infants/pets excluded from capacity
                  sessionId: cartId,
                  startTime: item.startTime,
                  endTime: item.endTime,
                },
                tx
              );
              createdHolds.push(hold.id);
            }
          }

          // Price calculation — infants and pets are FREE, only adults + children priced
          const pricing = await this.pricingEngine.calculateLineItem(
            item.adultPax,
            item.childPax,
            rates,
            item.date,
            item.addonIds
          );

          let serverPricedTotalCents = pricing.breakdown.finalTotalCents;
          const priceDuration = product.category === "vehicle" ? item.quantity || 1 : 1;
          serverPricedTotalCents *= priceDuration;

          const subtotalCents = serverPricedTotalCents;
          const isGroupPriced = (rates as any).pricingType === 'group';

          // unitPriceCents semantics differ by pricing model:
          //   per_person — price per individual guest (subtotal ÷ pax)
          //   group      — the flat rate IS the unit price (not divided by pax count)
          const unitPriceCents = isGroupPriced
            ? subtotalCents
            : (totalPricedPax > 0 ? Math.round(subtotalCents / totalPricedPax) : 0);

          // Group bookings are 1 unit; per-person bookings are counted by pax
          const cartQuantity = isGroupPriced ? 1 : totalPricedPax;

          cart.addItem({
            productId: product.id,
            name: product.title,
            unitPriceCents,
            quantity: cartQuantity,
            adultPax: item.adultPax,
            childPax: item.childPax,
            date: item.date,
            slot: item.slot,
            productType: product.category,
          });
        }

        // 2. Price the Cart via Pricing Context
        const snapshot = await this.priceCartService.priceCart(
          cartId,
          request.items.map((i) => ({
            productId: i.productId,
            adultPax: i.adultPax,
            childPax: i.childPax,
            quantity: i.quantity,
            addonIds: i.addonIds,
          }))
        );
        cart.setPricedSnapshot(snapshot);

        // 3. Create Booking Aggregate
        const bookingId = `book_${crypto.randomUUID()}`;
        const domainBooking = DomainBooking.createFromCart(bookingId, cart, {
          name: request.customerName,
          email: request.customerEmail,
          pickupLocation: request.pickupLocation,
        });

        // 4. Resolve aggregate time window
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

        // 5. Persist top-level booking record.
        // CRIT-3: tourId, date, tourName, holdId are FIRST-ITEM-ONLY convenience fields.
        const persistedBooking = await this.storage.createBooking(
          {
            id: domainBooking.id,
            customerName: domainBooking.customerName,
            customerEmail: domainBooking.customerEmail,
            customerPhone: request.customerPhone || null,
            amount: snapshot.totalCents.toString(),
            totalAmountCents: snapshot.totalCents,
            status: "pending",
            date: request.items[0].date,
            guests: request.items.reduce((sum, i) => sum + i.adultPax + i.childPax, 0),
            tourId: request.items[0].productId,
            tourName: cart.getItems()[0].name,
            adultPaxTotal: request.items.reduce((sum, i) => sum + i.adultPax, 0),
            childPaxTotal: request.items.reduce((sum, i) => sum + i.childPax, 0),
            infantPaxTotal: request.items.reduce((sum, i) => sum + (i.infantPax ?? 0), 0), // NEW
            petPaxTotal: request.items.reduce((sum, i) => sum + (i.petPax ?? 0), 0),    // NEW
            holdId: createdHolds[0] || null,
            bookingSessionId: cartId,
            idempotencyKey: request.idempotencyKey || null,
            startTime: aggregateStart,
            endTime: aggregateEnd,
            pickupLocation: request.pickupLocation || null,
          },
          tx
        );

        // 6. Persist all items
        for (let idx = 0; idx < cart.getItems().length; idx++) {
          const item = cart.getItems()[idx];
          const req = request.items[idx];
          await this.storage.createBookingItem(
            {
              bookingId: persistedBooking.id,
              productId: item.productId,
              productName: item.name,
              productType: item.productType,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              subtotalCents: item.unitPriceCents * item.quantity,
              adultPax: item.adultPax,
              childPax: item.childPax,
              infantPax: req?.infantPax ?? 0,  // NEW
              petPax: req?.petPax ?? 0,     // NEW
            },
            tx
          );
        }

        // 7. Emit Event
        await eventDispatcher.dispatch(
          new BookingCreated(domainBooking.id, domainBooking.amountCents)
        );

        return persistedBooking;
      } catch (error) {
        const elapsedMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "unknown_error";
        console.error(`[BOOKING_CREATION_FAILED] ${errorMessage}`, {
          request: { ...request, items: request.items.length },
          stack: error instanceof Error ? error.stack : undefined,
        });
        metricsService.incrementFailure(errorMessage);
        metricsService.recordErrorSnippet("BOOKING_CREATION_FAILED", errorMessage);
        metricsService.recordTransactionTime(elapsedMs);
        throw error;
      }
    });
  }
}
