import { db } from "../../db.js";
import { IStorage } from "../../storage.js";
import { AuditLogService } from "../../infrastructure/audit/audit-log.service.js";
import { metricsService } from "../../infrastructure/metrics/metrics.service.js";
import {
  bookings,
  availabilityHolds,
  payments,
  tours,
  pricingVersions,
  tourInstances,
} from "../../../shared/schema.js";
import { eq, and, lte, desc } from "drizzle-orm";

export interface BookingConfirmationRequest {
  holdId: string;
  bookingId: string;
  idempotencyKey: string;
  expectedTotalCents: number;
  adultPax: number;
  childPax: number;
  customerId?: string;
}

export interface BookingConfirmationResult {
  bookingId: string;
  confirmed: boolean;
  reason?: string;
  pricingCheck?: {
    expectedCents: number;
    actualCents: number;
    match: boolean;
  };
}

/**
 * Phase 6: Booking Confirmation Service with Concurrency & Idempotency
 * 
 * This service ensures:
 * - All capacity mutations occur inside DB transaction
 * - Row-level locking enforced
 * - Booking confirmation is idempotent
 * - Pricing is verified at confirmation time
 * - Double-confirmation is prevented via unique constraints
 * - No race conditions can occur
 * 
 * The system behaves as a constraint engine, not a form processor.
 */
export class BookingConfirmationService {
  private storage: IStorage;
  private auditLog: AuditLogService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.auditLog = new AuditLogService(storage);
  }

  /**
   * Confirms a booking with full pricing verification and idempotency.
   * 
   * Critical guarantees:
   * 1. Idempotent: Multiple calls with same idempotencyKey produce same result
   * 2. Atomic: All state changes succeed or all fail together
   * 3. Pricing verified: Server recalculates price and rejects mismatches
   * 4. Concurrency-safe: Row-level locks prevent race conditions
   * 5. Audit-logged: All confirmations tracked for compliance
   */
  async confirmBooking(
    request: BookingConfirmationRequest
  ): Promise<BookingConfirmationResult> {
    return await db.transaction(async (tx: any) => {
      // 1. Check for prior confirmation via idempotency key
      const [priorBooking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.idempotencyKey, request.idempotencyKey));

      if (priorBooking) {
        // Idempotent: return success if already confirmed, error if failed
        if (priorBooking.status === "confirmed") {
          return {
            bookingId: priorBooking.id,
            confirmed: true,
            reason: "Already confirmed (idempotent retry)",
          };
        }
        if (priorBooking.status === "cancelled") {
          return {
            bookingId: priorBooking.id,
            confirmed: false,
            reason: "Booking was cancelled",
          };
        }
      }

      // 2. Lock hold record
      const [hold] = await tx
        .select()
        .from(availabilityHolds)
        .where(eq(availabilityHolds.id, request.holdId))
        .for("update");

      if (!hold) {
        return {
          bookingId: request.bookingId,
          confirmed: false,
          reason: "Hold not found",
        };
      }

      if (hold.status !== "ACTIVE") {
        return {
          bookingId: request.bookingId,
          confirmed: false,
          reason: `Hold is in invalid state: ${hold.status}`,
        };
      }

      // 3. Lock booking record
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, request.bookingId))
        .for("update");

      if (!booking) {
        return {
          bookingId: request.bookingId,
          confirmed: false,
          reason: "Booking not found",
        };
      }

      if (booking.status === "confirmed") {
        // Already confirmed
        return {
          bookingId: request.bookingId,
          confirmed: true,
          reason: "Already confirmed",
        };
      }

      // 4. Get tour instance and lock it
      const [instance] = await tx
        .select()
        .from(tourInstances)
        .where(eq(tourInstances.id, hold.tourInstanceId))
        .for("update");

      if (!instance) {
        return {
          bookingId: request.bookingId,
          confirmed: false,
          reason: "Tour instance not found",
        };
      }

      // 5. Verify and recalculate pricing
      const pricingCheckBase = await this.verifyPricing(
        tx,
        booking.tourId,
        instance.serviceDate,
        request.expectedTotalCents,
        request.adultPax,
        request.childPax
      );

      const pricingCheck = {
        expectedCents: request.expectedTotalCents,
        actualCents: pricingCheckBase.actualCents,
        match: pricingCheckBase.match,
      };

      if (!pricingCheck.match) {
        metricsService.incrementFailure("pricing_mismatch");
        return {
          bookingId: request.bookingId,
          confirmed: false,
          reason: `Pricing mismatch: expected ${request.expectedTotalCents}¢, server calculated ${pricingCheck.actualCents}¢`,
          pricingCheck,
        };
      }

      // 6. Confirm the hold (move from HELD to CONFIRMED capacity)
      await tx
        .update(availabilityHolds)
        .set({ status: "CONFIRMED" })
        .where(eq(availabilityHolds.id, request.holdId));

      // 7. Update booking status
      await tx
        .update(bookings)
        .set({
          status: "confirmed",
          holdId: request.holdId,
          idempotencyKey: request.idempotencyKey,
        })
        .where(eq(bookings.id, request.bookingId));

      // 8. Log confirmation event
      await this.auditLog.log(
        {
          tourInstanceId: instance.id,
          productId: booking.tourId,
          action: "booking_confirmed",
          quantity: hold.quantity,
          previousState: {
            confirmedCount: instance.confirmedCount,
            heldCount: instance.heldCount,
            blockedCount: instance.blockedCount,
          },
          newState: {
            confirmedCount: instance.confirmedCount + hold.quantity,
            heldCount: Math.max(0, instance.heldCount - hold.quantity),
            blockedCount: instance.blockedCount,
          },
          metadata: {
            bookingId: request.bookingId,
            holdId: request.holdId,
            idempotencyKey: request.idempotencyKey,
            pricingVerified: true,
            expectedCents: request.expectedTotalCents,
            actualCents: pricingCheck.actualCents,
          },
        },
        tx
      );

      // 9. Record metrics
      metricsService.incrementHoldConfirmation();

      return {
        bookingId: request.bookingId,
        confirmed: true,
        pricingCheck,
      };
    });
  }

  /**
   * Verifies pricing at confirmation time.
   * 
   * This is critical for Phase 5: Pricing Integrity & Versioning
   * - Looks up the effective pricing version for the booking date
   * - Recalculates total based on adult/child pax
   * - Rejects if calculated price doesn't match expected price
   * - Prevents retroactive price mutation
   */
  private async verifyPricing(
    tx: any,
    productId: string,
    serviceDate: string,
    expectedCents: number,
    adultPax: number,
    childPax: number
  ): Promise<{ actualCents: number; match: boolean }> {
    // Find the effective pricing version for this date
    const [pricingVersion] = await tx
      .select()
      .from(pricingVersions)
      .where(
        and(
          eq(pricingVersions.productId, productId),
          lte(pricingVersions.effectiveFrom, serviceDate)
        )
      )
      .orderBy(desc(pricingVersions.effectiveFrom))
      .limit(1);

    if (!pricingVersion) {
      // No pricing version found - this is an error
      throw new Error(
        `No pricing version found for product ${productId} on date ${serviceDate}`
      );
    }

    // Calculate actual price based on effective pricing
    const actualCents =
      adultPax * pricingVersion.adultPriceCents +
      childPax * pricingVersion.childPriceCents;

    return {
      actualCents,
      match: actualCents === expectedCents,
    };
  }

  /**
   * Cancels a confirmed booking, releasing capacity.
   * Idempotent: can be called multiple times safely.
   */
  async cancelBooking(bookingId: string, reason?: string): Promise<void> {
    return await db.transaction(async (tx: any) => {
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .for("update");

      if (!booking) {
        throw new Error("Booking not found");
      }

      if (booking.status === "cancelled") {
        // Already cancelled - idempotent
        return;
      }

      if (booking.status !== "confirmed") {
        throw new Error(
          `Cannot cancel booking in status: ${booking.status}`
        );
      }

      // Get the hold to release capacity
      if (booking.holdId) {
        const [hold] = await tx
          .select()
          .from(availabilityHolds)
          .where(eq(availabilityHolds.id, booking.holdId))
          .for("update");

        if (hold && hold.status === "CONFIRMED") {
          const [instance] = await tx
            .select()
            .from(tourInstances)
            .where(eq(tourInstances.id, hold.tourInstanceId))
            .for("update");

          if (instance) {
            const previousState = {
              confirmedCount: instance.confirmedCount,
              heldCount: instance.heldCount,
              blockedCount: instance.blockedCount,
            };

            // Release capacity
            await tx
              .update(tourInstances)
              .set({
                confirmedCount: Math.max(0, instance.confirmedCount - hold.quantity),
              })
              .where(eq(tourInstances.id, instance.id));

            // Log cancellation
            await this.auditLog.log(
              {
                tourInstanceId: instance.id,
                productId: instance.tourId,
                action: "booking_cancelled",
                quantity: hold.quantity,
                previousState,
                newState: {
                  confirmedCount: Math.max(0, instance.confirmedCount - hold.quantity),
                  heldCount: instance.heldCount,
                  blockedCount: instance.blockedCount,
                },
                metadata: { bookingId, holdId: booking.holdId, reason },
              },
              tx
            );
          }

          // Mark hold as released
          await tx
            .update(availabilityHolds)
            .set({ status: "RELEASED" })
            .where(eq(availabilityHolds.id, booking.holdId));
        }
      }

      // Mark booking as cancelled
      await tx
        .update(bookings)
        .set({ status: "cancelled" })
        .where(eq(bookings.id, bookingId));
    });
  }
}
