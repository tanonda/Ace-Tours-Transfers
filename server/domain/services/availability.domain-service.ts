import { Tour, Booking } from "../../../shared/schema.js";
import { isSameDay } from "date-fns";
import { IStorage } from "../../storage.js";
import { PricingEngine } from "../pricing/PricingEngine.js";
import { availabilityCache } from "../../infrastructure/cache/availability-cache.service.js";
import { capacityAlertService } from "../../application/alerts/capacity-alert.service.js";
import { TimeInterval, intervalsOverlap, getDefaultInterval } from "../availability/time-interval.js";

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
  private pricingEngine: PricingEngine;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.pricingEngine = new PricingEngine(storage);
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
    addonIds?: string[],
    startTime?: string,
    endTime?: string
  ): Promise<AvailabilityResult> {
    // Validation
    if (requestedGuests <= 0) {
      return {
        isAvailable: false,
        remainingCapacity: 0,
        message: "Requested guests must be at least 1.",
      };
    }

    // Phase 4: Blackout check (early rejection before any capacity/pricing work)
    const isBlacked = await this.storage.isBlackedOut(productId, date);
    if (isBlacked) {
      return {
        isAvailable: false,
        remainingCapacity: 0,
        message: `This date (${date}) is not available for bookings (blackout period).`,
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
      product.category,
      date,
      slot,
      startTime,
      endTime
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

  private async calculateRemainingCapacity(
    productId: string,
    category: string,
    date: string,
    slot?: string,
    startTime?: string,
    endTime?: string
  ): Promise<number> {
    // Phase 1: Vehicles check discrete resources instead of pooled instances
    if (category === 'vehicle') {
      const availableResources = await this.storage.getAvailableResources(productId, date);
      return availableResources.length;
    }

    // 1. Check cache first
    const cacheKey = slot || (startTime && endTime ? `${startTime}-${endTime}` : "default");
    const cached = availabilityCache.get(productId, date, cacheKey);
    if (cached) {
      return cached.remainingCapacity;
    }

    // Phase 2: Refactored to handle multiple sessions per day via overlap detection
    const requestedInterval = getDefaultInterval(category, startTime, endTime);

    // Fetch all instances for this product on this date
    const allInstances = await this.storage.getTourInstances(productId, date);

    // Find instances that overlap with the requested interval
    const overlappingInstances = allInstances.filter(instance => {
      if (slot && instance.timeSlot === slot) return true;
      const instanceInterval: TimeInterval = { startTime: instance.startTime, endTime: instance.endTime };
      return intervalsOverlap(requestedInterval, instanceInterval);
    });

    if (overlappingInstances.length === 0) {
      // No instance exists - need to check tour's default capacity
      const product = await this.storage.getTour(productId);
      if (!product) throw new Error(`Product ${productId} not found`);

      const defaultCapacity = product.defaultCapacity;
      if (!defaultCapacity || defaultCapacity <= 0) {
        throw new Error(
          `Product "${product.title}" has invalid or missing capacity (${defaultCapacity}). ` +
          `Please configure capacity in the admin panel.`
        );
      }

      availabilityCache.set(productId, date, defaultCapacity, defaultCapacity, cacheKey);
      return defaultCapacity;
    }

    // 3. Calculate remaining = total - (confirmed + held + blocked)
    // Minimum remaining capacity across all overlapping pools
    let minAvailable = Infinity;
    let totalCap = 0;

    for (const instance of overlappingInstances) {
      const available = instance.totalCapacity - (instance.confirmedCount + instance.heldCount + instance.blockedCount);
      if (available < minAvailable) {
        minAvailable = available;
        totalCap = instance.totalCapacity;
      }
    }

    const finalRemaining = Math.max(0, minAvailable === Infinity ? 0 : minAvailable);

    // 4. Cache the result
    availabilityCache.set(
      productId,
      date,
      finalRemaining,
      totalCap,
      cacheKey
    );

    // 5. Check capacity alerts
    const product = await this.storage.getTour(productId);
    if (product) {
      capacityAlertService.checkCapacity(
        productId,
        product.title,
        date,
        totalCap,
        finalRemaining
      );
    }

    return finalRemaining;
  }

  /**
   * Calculates pricing for the requested booking.
   * Uses PricingEngine for consistent pricing logic.
   */
  private async calculatePricing(
    productId: string,
    adultPax: number,
    childPax: number,
    date: string,
    addonIds?: string[]
  ): Promise<AvailabilityResult['pricing']> {
    // Get rates
    const rates = await this.pricingEngine.getTourRate(productId, date);
    if (!rates) {
      return {
        subtotalCents: 0,
        breakdown: { adultSubtotal: 0, childSubtotal: 0, addonsTotal: 0 },
      };
    }

    // Calculate pricing using PricingEngine
    const pricing = await this.pricingEngine.calculateLineItem(
      adultPax,
      childPax,
      rates,
      date,
      addonIds
    );

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

    // Calculate base subtotals (for detailed breakdown)
    const adultSubtotal = adultPax * rates.adultPriceCents;
    const childSubtotal = childPax * rates.childPriceCents;

    // Use PricingEngine's calculated total as the source of truth
    const subtotalCents = pricing.breakdown.finalTotalCents;

    // Track applied discounts from pricing engine
    const appliedDiscounts: string[] = [];
    if (pricing.breakdown.discountApplied) {
      appliedDiscounts.push("10% group discount (7+ adults)");
    }
    if (pricing.breakdown.surchargeApplied) {
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
