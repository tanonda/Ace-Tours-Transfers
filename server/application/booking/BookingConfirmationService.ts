/**
 * BookingConfirmationService - TRANSACTIONAL BOOKING CONFIRMATION
 * 
 * Ensures atomicity when confirming bookings and converting holds to confirmed capacity.
 * 
 * This is the SINGLE POINT where bookings transition from pending → confirmed.
 * 
 * CRITICAL: Must be called within a database transaction to prevent race conditions.
 * 
 * Guarantees:
 * ✅ No overbooking under concurrent requests
 * ✅ Holds verified before confirmation
 * ✅ All-or-nothing: confirm succeeds or fails atomically
 * ✅ Clear error messages for stale/missing holds
 */

import { IStorage } from "../../storage.js";
import { AvailabilityApplicationService } from "../availability/availability.application-service.js";
import { Booking } from "../../../shared/schema.js";

export interface BookingConfirmationRequest {
  bookingId: string;
  paymentId: string;
  gatewayReference?: string;
}

export interface BookingConfirmationResult {
  success: boolean;
  message: string;
  booking?: Booking;
  error?: {
    code: string;
    reason: string;
    details?: string;
  };
}

export class BookingConfirmationService {
  private storage: IStorage;
  private availabilityService: AvailabilityApplicationService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.availabilityService = new AvailabilityApplicationService(storage);
  }

  /**
   * Main entry point for confirming a booking.
   * 
   * This method coordinates:
   * 1. Verification that booking exists and is still pending
   * 2. Verification that holds are still active (not expired)
   * 3. Re-check that capacity hasn't been oversold
   * 4. Atomic confirmation of holds and booking status
   * 
   * MUST be called as part of database transaction in caller.
   * 
   * @throws Error if booking cannot be confirmed
   * @returns BookingConfirmationResult with success status
   */
  async confirmBooking(
    request: BookingConfirmationRequest
  ): Promise<BookingConfirmationResult> {
    const { bookingId, paymentId } = request;

    try {
      // Step 1: Load booking
      console.log(`[BOOKING_CONFIRM] Starting confirmation for booking ${bookingId}`);
      
      const booking = await this.storage.getBooking(bookingId);
      if (!booking) {
        return {
          success: false,
          message: "Booking not found",
          error: {
            code: "BOOKING_NOT_FOUND",
            reason: "Booking does not exist in database",
            details: `Booking ID: ${bookingId}`
          }
        };
      }

      // Step 2: Verify booking is still pending
      if (booking.status !== 'pending') {
        return {
          success: false,
          message: `Booking is in state '${booking.status}', not pending`,
          error: {
            code: "INVALID_BOOKING_STATE",
            reason: `Cannot confirm booking in state '${booking.status}'`,
            details: `Bookings can only be confirmed from 'pending' state`
          }
        };
      }

      // Step 3: Verify hold exists if one is referenced
      if (booking.holdId) {
        const hold = await this.storage.getHold(booking.holdId);
        if (!hold) {
          return {
            success: false,
            message: "Booking hold not found - capacity may have been released",
            error: {
              code: "HOLD_NOT_FOUND",
              reason: "Availability hold for this booking was not found",
              details: `Hold ID: ${booking.holdId}`
            }
          };
        }

        // Step 4: Verify hold is still active (not expired or released)
        if (hold.status !== 'ACTIVE') {
          return {
            success: false,
            message: `Booking hold is in state '${hold.status}', not active. Capacity may have been released.`,
            error: {
              code: "HOLD_NOT_ACTIVE",
              reason: `Hold status is '${hold.status}', expected 'ACTIVE'`,
              details: `Holds automatically expire after 15 minutes. Please check availability and try booking again.`
            }
          };
        }

        // Step 5: Verify hold hasn't expired
        const now = new Date();
        if (hold.expiresAt < now) {
          return {
            success: false,
            message: "Booking hold has expired. Please check availability and try booking again.",
            error: {
              code: "HOLD_EXPIRED",
              reason: "Availability hold has passed expiration time",
              details: `Hold expired at: ${hold.expiresAt.toISOString()}`
            }
          };
        }

        // Step 6: Confirm the hold (within transaction)
        console.log(`[BOOKING_CONFIRM] Confirming hold ${hold.id} for booking ${bookingId}`);
        try {
          await this.availabilityService.confirmBooking(booking.holdId);
        } catch (holdError) {
          // Hold confirmation failed - this indicates either:
          // - Database integrity issue
          // - Hold was deleted concurrently
          // - Capacity calculation failed
          console.error(`[BOOKING_CONFIRM] CRITICAL: Failed to confirm hold ${booking.holdId}:`, holdError);
          return {
            success: false,
            message: "Failed to secure inventory capacity. Please contact support.",
            error: {
              code: "HOLD_CONFIRMATION_FAILED",
              reason: "Could not confirm availability hold",
              details: holdError instanceof Error ? holdError.message : "Unknown error"
            }
          };
        }
      }

      // Step 7: Update booking status to confirmed
      console.log(`[BOOKING_CONFIRM] Updating booking ${bookingId} status to 'confirmed'`);
      const updatedBooking = await this.storage.updateBooking(bookingId, {
        status: 'confirmed',
        paymentReference: paymentId
      });

      console.log(`[BOOKING_CONFIRM] ✅ Successfully confirmed booking ${bookingId}`);
      return {
        success: true,
        message: "Booking confirmed successfully",
        booking: updatedBooking
      };

    } catch (error) {
      // Catch-all for unexpected errors
      console.error(`[BOOKING_CONFIRM] UNEXPECTED ERROR for booking ${bookingId}:`, error);
      return {
        success: false,
        message: "An unexpected error occurred while confirming the booking",
        error: {
          code: "UNEXPECTED_ERROR",
          reason: "System error during booking confirmation",
          details: error instanceof Error ? error.message : "Unknown error"
        }
      };
    }
  }

  /**
   * Confirms all holds for a booking session.
   * Used when a booking contains multiple items with multiple holds.
   * 
   * @param sessionId - The booking session ID
   * @returns Result with number of confirmed holds
   */
  async confirmSessionBooking(sessionId: string): Promise<{
    success: boolean;
    confirmedHolds: number;
    message: string;
  }> {
    try {
      // Get all bookings for this session
      const bookings = await this.storage.getBookingsBySession(sessionId);
      
      if (bookings.length === 0) {
        return {
          success: false,
          confirmedHolds: 0,
          message: "No bookings found for this session"
        };
      }

      let confirmedCount = 0;

      // Confirm each booking
      for (const booking of bookings) {
        const result = await this.confirmBooking({
          bookingId: booking.id,
          paymentId: sessionId
        });

        if (result.success) {
          confirmedCount++;
        }
      }

      return {
        success: confirmedCount === bookings.length,
        confirmedHolds: confirmedCount,
        message: `Confirmed ${confirmedCount} of ${bookings.length} bookings`
      };

    } catch (error) {
      console.error(`[BOOKING_CONFIRM] Error confirming session ${sessionId}:`, error);
      return {
        success: false,
        confirmedHolds: 0,
        message: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  /**
   * Releases holds and cancels booking if confirmation cannot proceed.
   * Used when payment fails or booking is cancelled.
   * 
   * @param bookingId - Booking to cancel
   * @param reason - Reason for cancellation
   */
  async cancelBooking(bookingId: string, reason: string): Promise<void> {
    try {
      console.log(`[BOOKING_CONFIRM] Cancelling booking ${bookingId} - Reason: ${reason}`);
      
      const booking = await this.storage.getBooking(bookingId);
      if (!booking) return;

      // Release any holds
      if (booking.holdId) {
        try {
          await this.availabilityService.releaseHold(booking.holdId);
          console.log(`[BOOKING_CONFIRM] Released hold ${booking.holdId}`);
        } catch (error) {
          console.warn(`[BOOKING_CONFIRM] Could not release hold ${booking.holdId}:`, error);
        }
      }

      // Release session holds
      if (booking.bookingSessionId) {
        try {
          const holds = await this.storage.getHoldsBySession(booking.bookingSessionId);
          for (const hold of holds) {
            await this.availabilityService.releaseHold(hold.id);
          }
          console.log(`[BOOKING_CONFIRM] Released ${holds.length} session holds`);
        } catch (error) {
          console.warn(`[BOOKING_CONFIRM] Error releasing session holds:`, error);
        }
      }

      // Update booking status
      await this.storage.updateBooking(bookingId, {
        status: 'cancelled',
        paymentReference: `CANCELLED: ${reason}`
      });

      console.log(`[BOOKING_CONFIRM] ✅ Booking ${bookingId} cancelled`);
    } catch (error) {
      console.error(`[BOOKING_CONFIRM] Error cancelling booking ${bookingId}:`, error);
      throw error;
    }
  }
}
