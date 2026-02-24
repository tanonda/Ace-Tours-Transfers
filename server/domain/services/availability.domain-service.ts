import { Tour, Booking } from "../../../shared/schema.js";
import { isSameDay, eachDayOfInterval, parseISO, format } from "date-fns";
import { IStorage } from "../../storage.js";
import { PricingEngine } from "../pricing/PricingEngine.js";
import { availabilityCache } from "../../infrastructure/cache/availability-cache.service.js";
import { capacityAlertService } from "../../application/alerts/capacity-alert.service.js";
import { TimeInterval, intervalsOverlap, getDefaultInterval } from "../availability/time-interval.js";

export interface AvailabilityResult {
  isAvailable: boolean;
  remainingCapacity: number;
  totalCapacity: number;
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
        totalCapacity: 0,
        message: "Requested guests must be at least 1.",
      };
    }

    // Phase 4: Blackout check (early rejection before any capacity/pricing work)
    const isBlacked = await this.storage.isBlackedOut(productId, date);
    if (isBlacked) {
      return {
        isAvailable: false,
        remainingCapacity: 0,
        totalCapacity: 0,
        message: `This date (${date}) is not available for bookings (blackout period).`,
      };
    }

    // Fetch product
    const product = await this.storage.getTour(productId);
    if (!product) {
      return {
        isAvailable: false,
        remainingCapacity: 0,
        totalCapacity: 0,
        message: "Product not found.",
      };
    }

    // Calculate remaining capacity using tour_instances and holds
    const { remainingCapacity, totalCapacity } = await this.calculateRemainingCapacity(
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
      totalCapacity,
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
  ): Promise<{ remainingCapacity: number; totalCapacity: number }> {
    // Phase 1: Vehicles check discrete resources instead of pooled instances
    if (category === 'vehicle') {
      const allResources = await this.storage.getResourcesByProduct(productId);
      if (allResources.length > 0) {
        const availableResources = await this.storage.getAvailableResources(productId, date, startTime, endTime);
        return {
          remainingCapacity: availableResources.length,
          totalCapacity: allResources.length
        };
      }
      // If no discrete resources are defined, fall back to pooled capacity (tourInstances or defaultCapacity)
    }

    // 1. Check cache first
    const cacheKey = slot || (startTime && endTime ? `${startTime}-${endTime}` : "default");
    const cached = availabilityCache.get(productId, date, cacheKey);
    if (cached) {
      return {
        remainingCapacity: cached.remainingCapacity,
        totalCapacity: cached.totalCapacity
      };
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
        console.warn(
          `Product "${product.title}" (${productId}) has invalid or missing capacity (${defaultCapacity}). ` +
          `Please configure capacity in the admin panel.`
        );
        return { remainingCapacity: 0, totalCapacity: 0 };
      }

      availabilityCache.set(productId, date, defaultCapacity, defaultCapacity, cacheKey);
      return { remainingCapacity: defaultCapacity, totalCapacity: defaultCapacity };
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

    return { remainingCapacity: finalRemaining, totalCapacity: totalCap };
  }

  /**
   * Checks availability for a range of dates.
   * Useful for calendar views.
   */
  async getAvailabilityRange(
    productId: string,
    startDate: string,
    endDate: string,
    minGuests: number = 1
  ): Promise<Record<string, {
    isAvailable: boolean,
    remainingCapacity: number,
    totalCapacity: number
  }>> {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const dates = eachDayOfInterval({ start, end });

    const product = await this.storage.getTour(productId);
    if (!product) throw new Error("Product not found");

    const results: Record<string, any> = {};

    // For range checks, we use Promise.all to parallelize daily checks for better performance
    const resultsArray = await Promise.all(dates.map(async (d) => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const { remainingCapacity, totalCapacity } = await this.calculateRemainingCapacity(
        productId,
        product.category,
        dateStr
      );

      return {
        dateStr,
        isAvailable: remainingCapacity >= minGuests,
        remainingCapacity,
        totalCapacity
      };
    }));

    // Convert array back to record
    resultsArray.forEach(res => {
      results[res.dateStr] = {
        isAvailable: res.isAvailable,
        remainingCapacity: res.remainingCapacity,
        totalCapacity: res.totalCapacity
      };
    });

    return results;
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
    const appliedDiscounts = pricing.breakdown.appliedRules;

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

  /**
   * Returns available time slots for a given product and date.
   * - For Tours: Returns scheduled instances (e.g. 09:00, 14:00)
   * - For Transfers/Vehicles: Generates 30-min intervals (06:00 - 20:00)
   */
  async getAvailableSlots(
    productId: string,
    date: string,
    guests: number
  ): Promise<{ time: string; available: boolean; remaining: number }[]> {
    const product = await this.storage.getTour(productId);
    if (!product) throw new Error("Product not found");

    // 1. Check blackout
    const isBlacked = await this.storage.isBlackedOut(productId, date);
    if (isBlacked) return [];

    const slots: { time: string; available: boolean; remaining: number; sortOrder: number }[] = [];

    if (product.category === "tour") {
      // Fetch instances for tours
      const instances = await this.storage.getTourInstances(productId, date);

      if (instances.length > 0) {
        // Use defined instances
        for (const instance of instances) {
          if (!instance.startTime) continue; // Skip full-day instances for slot list? Or treat as "Any time"? Let's stick to explicit times.

          const available = instance.totalCapacity - (instance.confirmedCount + instance.heldCount + instance.blockedCount);
          slots.push({
            time: instance.startTime,
            available: available >= guests,
            remaining: available,
            sortOrder: parseInt(instance.startTime.replace(":", ""))
          });
        }
      } else {
        // No instances? If defaultCapacity exists, maybe implied full availability? 
        // For now, return empty to imply "No scheduled departures".
        // Or if we want to fallback to a default time:
        // if (product.defaultCapacity) ...
      }
    } else {
      // Transfers and Vehicles: Generate slots
      // 06:00 to 20:00 every 30 mins
      const startHour = 6;
      const endHour = 20;

      for (let hour = startHour; hour <= endHour; hour++) {
        for (let min = 0; min < 60; min += 30) {
          const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

          // Check availability for this specific slot
          // Note: This calls calculateRemainingCapacity loop, might be heavy if not cached.
          // But category='vehicle' uses resource check which is fast.
          // category='transfer' might be logical usage.

          const { remainingCapacity } = await this.calculateRemainingCapacity(
            productId,
            product.category,
            date,
            undefined,
            time,
            time // simple point-in-time check
          );

          slots.push({
            time,
            available: remainingCapacity >= guests,
            remaining: remainingCapacity,
            sortOrder: hour * 100 + min
          });
        }
      }
    }

    return slots
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ time, available, remaining }) => ({ time, available, remaining }));
  }
}
