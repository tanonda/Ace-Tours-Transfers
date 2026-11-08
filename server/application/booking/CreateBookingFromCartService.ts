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
import { vanuatuTodayISO } from "../../lib/business-time.js";

export interface CreateBookingRequest {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
  idempotencyKey?: string;
  promoCode?: string;
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
  locale?: string;
}

/** The exact shape the pricing engine needs; the date drives version + peak season. */
export function toPriceCartItems(items: CreateBookingRequest["items"]) {
  return items.map((item) => ({
    productId: item.productId,
    adultPax: item.adultPax,
    childPax: item.childPax,
    quantity: item.quantity,
    addonIds: item.addonIds,
    date: item.date,
  }));
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

    // A retry with the same idempotency key must return the booking created by the
    // first attempt. Checking before any hold is created prevents the retry from
    // leaving orphan holds attached to no booking.
    if (request.idempotencyKey) {
      const existing = await this.storage.getBookingByIdempotencyKey(request.idempotencyKey);
      if (existing) {
        console.log(`[BOOKING] Idempotent replay for key ${request.idempotencyKey}: returning ${existing.id}`);
        return existing;
      }
    }

    // Each booking owns its holds: the booking ID is the hold-group key
    // (bookings.bookingSessionId / availability_holds.bookingSessionId). Using the
    // browser session here made a guest's separate bookings share holds, so paying
    // for one confirmed or released the others.
    const bookingId = `book_${crypto.randomUUID()}`;
    const cartId = bookingId;
    const cart = new Cart(cartId);

    // Phase 4: Wrap EVERYTHING in a single atomic transaction
    try {
      return await db.transaction(async (tx: any) => {
      const createdHolds: string[] = [];
      let firstTourInstanceId: string | null = null;
      const productCategories = new Set<string>();

      try {
        // 1. Build Cart items and create holds ATOMICALLY
        for (const item of request.items) {
          const product = await this.storage.getProduct(item.productId);
          if (!product) throw new Error(`Product ${item.productId} not found`);
          if (!product.isActive) throw new Error(`Product "${product.title}" is no longer available`);
          productCategories.add(product.category === "transfer" ? "transfers" : "tours");

          const rates = await this.pricingEngine.getTourRate(item.productId, item.date);
          if (!rates) throw new Error(`Rates for product ${item.productId} not found`);

          // PRICING NOTE: Infants and pets do NOT count toward capacity or pricing.
          // Only adults and children consume seats / affect price.
          const totalPricedPax = item.adultPax + item.childPax;

          if (totalPricedPax > 0) {
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
            if (!firstTourInstanceId) firstTourInstanceId = hold.tourInstanceId;
          }

          // Price calculation — infants and pets are FREE, only adults + children priced
          const pricing = await this.pricingEngine.calculateLineItem(
            item.adultPax,
            item.childPax,
            rates,
            item.date,
            item.addonIds
          );

          const subtotalCents = pricing.breakdown.finalTotalCents;
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
          toPriceCartItems(request.items)
        );
        // Promotion codes are validated here, after the subtotal is known, and the
        // usage is claimed in this same transaction (a failed booking rolls it back).
        let discountCents = 0;
        let appliedPromoCode: string | null = null;
        if (request.promoCode) {
          const promo = await this.storage.getPromotionByCode(request.promoCode);
          if (!promo || !promo.isActive) throw new Error("Invalid or inactive promo code");
          const today = vanuatuTodayISO();
          if (today < promo.validFrom || today > promo.validTo) throw new Error("This promo code has expired");
          if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) throw new Error("This promo code has reached its usage limit");
          if (promo.minPurchaseCents > 0 && snapshot.totalCents < promo.minPurchaseCents) {
            throw new Error(`This promo code needs a minimum purchase of ${promo.minPurchaseCents} cents`);
          }
          const applicable = promo.applicableTo || "all";
          if (applicable !== "all" && !productCategories.has(applicable)) {
            throw new Error("This promo code is not valid for the items in your cart");
          }
          discountCents = promo.discountType === "percentage"
            ? Math.round(snapshot.totalCents * (promo.discountValue / 100))
            : promo.discountValue;
          discountCents = Math.min(Math.max(discountCents, 0), snapshot.totalCents);
          if (!(await this.storage.claimPromotion(promo.id, tx))) {
            throw new Error("This promo code has reached its usage limit");
          }
          appliedPromoCode = promo.code;
        }

        cart.setPricedSnapshot(
          discountCents > 0
            ? { ...snapshot, totalCents: snapshot.totalCents - discountCents, discountCents, promoCode: appliedPromoCode } as any
            : snapshot,
        );

        // 3. Create Booking Aggregate
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
            customerPhone: request.customerPhone?.trim() || null,
            notes: request.notes?.trim() || null,
            amount: snapshot.totalCents.toString(),
            totalAmountCents: snapshot.totalCents,
            status: "pending",
            date: request.items[0].date,
            guests: request.items.reduce((sum, i) => sum + i.adultPax + i.childPax, 0),
            tourId: request.items[0].productId,
            tourInstanceId: firstTourInstanceId,
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
            locale: request.locale || "en",
            promoCode: appliedPromoCode,
            discountCents,
          },
          tx
        );

        if (persistedBooking.id !== bookingId) {
          throw new DuplicateBookingError(persistedBooking);
        }

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

        // 6b. Persist the selected add-ons for reporting/refunds. The price was
        // already included by priceCart's addonIds calculation.
        for (const item of request.items) {
          for (const addonId of item.addonIds ?? []) {
            const addon = await this.storage.getAddon(addonId);
            if (!addon) continue;
            await this.storage.createBookingAddon({
              bookingId: persistedBooking.id,
              addonId: addon.id,
              unitPriceCents: addon.priceCents,
              quantity: 1,
            }, tx);
          }
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
    } catch (error) {
      // A concurrent first attempt can win the unique index between our lookup and
      // insert. Its transaction owns the holds; ours rolled back, so return it.
      if (error instanceof DuplicateBookingError) {
        console.warn(`[BOOKING] Concurrent idempotent replay; returning ${error.booking.id}`);
        return error.booking;
      }
      throw error;
    }
  }
}

class DuplicateBookingError extends Error {
  constructor(public readonly booking: SchemaBooking) {
    super(`Booking already exists for this idempotency key: ${booking.id}`);
    this.name = "DuplicateBookingError";
  }
}
