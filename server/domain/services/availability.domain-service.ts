import { Tour, Booking } from "../../../shared/schema.js";
import { isSameDay } from "date-fns";
import { IStorage } from "../../storage.js";
import { PriceResolver } from "../pricing/PriceResolver.js";
import { availabilityCache } from "../../infrastructure/cache/availability-cache.service.js";
import { capacityAlertService } from "../../application/alerts/capacity-alert.service.js";

export interface AvailabilityResult {
  isAvailable: boolean;
  remainingCapacity: number;
  message: string;
  pricing?: {
    subtotalCents: number;
    breakdown: {
      adultSubtotal: number;
      childSubtotal: number;
      addonsTotal: number;
    };
    appliedDiscounts?: string[];
  };
}

/**
 * AvailabilityDomainService - Centralized constraint validation engine
 * 
 * This service is the SINGLE SOURCE OF TRUTH for availability checks.
 * It uses tour_instances and availability_holds to determine real-time capacity.
 * 
 * IMPORTANT: This is a PURE validation service - it does NOT mutate state.
 * It does NOT create bookings, holds, or reservations.
 */
export class AvailabilityDomainService {
  private storage: IStorage;
  private priceResolver: PriceResolver;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.priceResolver = new PriceResolver(storage);
  }

  /**
   * Checks availability for a specific product, date, and guest count.
   * Returns structured availability + pricing response.
   * 
   * @param productId - The product/tour ID
   * @param date - Service date (YYYY-MM-DD)
   * @param requestedGuests - Total number of guests (adults + children)
   * @param adultPax - Number of adults (for pricing)
   * @param childPax - Number of children (for pricing)
   * @param slot - Optional time slot
   * @param addonIds - Optional array of addon IDs
   * @returns AvailabilityResult with capacity and pricing info
   */
  async checkAvailability(
    productId: string,
    date: string,
    requestedGuests: number,
    adultPax: number,
    childPax: number,
    slot?: string,
    addonIds?: string[]
  ): Promise<AvailabilityResult> {
    // Validation
    if (requestedGuests <= 0) {
      return {
        isAvailable: false,
        remainingCapacity: 0,
        message: "Requested guests must be at least 1.",
      };
    }

    // Fetch product
    const product = await this.storage.getTour(productId);
    if (!product) {
      return {
        isAvailable: false,
        remainingCapacity: 0,
        message: "Product not found.",
      };
    }

    // Calculate remaining capacity using tour_instances and holds
    const remainingCapacity = await this.calculateRemainingCapacity(
      productId,
      date,
      slot
    );

    // Check if available
    const isAvailable = remainingCapacity >= requestedGuests;

    // Calculate pricing
    const pricing = await this.calculatePricing(
      productId,
      adultPax,
      childPax,
      date,
      addonIds
    );

    // Build response message
    let message: string;
    if (isAvailable) {
      message = `Available! ${remainingCapacity} seats remaining.`;
    } else if (remainingCapacity > 0) {
      message = `Not enough capacity. Only ${remainingCapacity} seats remaining.`;
    } else {
      message = "Fully booked.";
    }

    return {
      isAvailable,
      remainingCapacity,
      message,
      pricing,
    };
  }

  /**
   * Calculates remaining capacity for a product on a specific date.
   * Uses tour_instances as the authoritative source with caching.
   */
  private async calculateRemainingCapacity(
    productId: string,
    date: string,
    slot?: string
  ): Promise<number> {
    // 1. Check cache first
    const cached = availabilityCache.get(productId, date, slot);
    if (cached) {
      return cached.remainingCapacity;
    }

    // 2. Check if tour instance exists
    const instance = await this.storage.getTourInstance(productId, date, slot);

    if (!instance) {
      // No instance exists - need to check tour's default capacity
      const product = await this.storage.getTour(productId);
      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // CRITICAL: Validate capacity is explicitly configured
      const defaultCapacity = product.defaultCapacity;
      if (!defaultCapacity || defaultCapacity <= 0) {
        throw new Error(
          `Product "${product.title}" has invalid or missing capacity (${defaultCapacity}). ` +
          `Please configure capacity in the admin panel.`
        );
      }

      // Cache the default capacity
      availabilityCache.set(productId, date, defaultCapacity, defaultCapacity, slot);
      return defaultCapacity;
    }

    // 3. Calculate remaining = total - (confirmed + held + blocked)
    const remaining =
      instance.totalCapacity -
      (instance.confirmedCount + instance.heldCount + instance.blockedCount);

    const finalRemaining = Math.max(0, remaining);

    // 4. Cache the result
    availabilityCache.set(
      productId,
      date,
      finalRemaining,
      instance.totalCapacity,
      slot
    );

    // 5. Check capacity alerts
    const product = await this.storage.getTour(productId);
    if (product) {
      capacityAlertService.checkCapacity(
        productId,
        product.title,
        date,
        instance.totalCapacity,
        finalRemaining
      );
    }

    return finalRemaining;
  }

  /**
   * Calculates pricing for the requested booking.
   * Uses PriceResolver for consistent pricing logic.
   */
  private async calculatePricing(
    productId: string,
    adultPax: number,
    childPax: number,
    date: string,
    addonIds?: string[]
  ): Promise<AvailabilityResult['pricing']> {
    // Get rates
    const rates = await this.priceResolver.getTourRate(productId);
    if (!rates) {
      return {
        subtotalCents: 0,
        breakdown: { adultSubtotal: 0, childSubtotal: 0, addonsTotal: 0 },
      };
    }

    // Calculate addon total
    let addonsTotal = 0;
    if (addonIds && addonIds.length > 0) {
      const addons = await Promise.all(
        addonIds.map((id) => this.storage.getAddon(id))
      );
      addonsTotal = addons.reduce(
        (sum, addon) => sum + (addon?.priceCents || 0),
        0
      );
    }

    // Calculate base subtotals
    const adultSubtotal = adultPax * rates.adultPriceCents;
    const childSubtotal = childPax * rates.childPriceCents;

    // Calculate total with pricing rules (discounts, seasonal)
    const subtotalCents = this.priceResolver.calculateItemTotal(
      adultPax,
      childPax,
      rates,
      addonsTotal,
      date
    );

    // Track applied discounts
    const appliedDiscounts: string[] = [];
    if (adultPax >= 7) {
      appliedDiscounts.push("10% group discount (7+ adults)");
    }
    const bookingDate = new Date(date);
    const month = bookingDate.getMonth();
    if (month === 11 || month === 0) {
      appliedDiscounts.push("20% peak season surcharge (Dec/Jan)");
    }

    return {
      subtotalCents,
      breakdown: {
        adultSubtotal,
        childSubtotal,
        addonsTotal,
      },
      appliedDiscounts: appliedDiscounts.length > 0 ? appliedDiscounts : undefined,
    };
  }

  /**
   * LEGACY: Kept for backward compatibility during migration
   * @deprecated Use checkAvailability instead
   */
  calculateAvailableSlots(service: Tour, date: Date, existingBookings: Booking[]): number {
    const totalCapacity = service.capacity;
    const bookedGuests = existingBookings.reduce((sum, booking) => {
      const bookingDate = new Date(booking.date);
      if (isSameDay(bookingDate, date) && booking.status !== "cancelled") {
        return sum + booking.guests;
      }
      return sum;
    }, 0);
    return Math.max(0, totalCapacity - bookedGuests);
  }
}
