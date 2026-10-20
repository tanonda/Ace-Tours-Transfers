// Completes a booking an admin confirmed by hand (a bank statement match, or PATCH to confirmed) the
// way a gateway payment completes one:
//  - confirmWithSeats confirms the booking's seat holds in the same transaction as the status write
//    (a lapsed hold of its own is re-reserved if the date is open and capacity allows), so the
//    hold-expiry job never frees them, and a booking whose seats are gone stays pending;
//  - completeManualConfirmation then marks its open offline payment `completed`, so the bank transfer
//    saga stops tracking it and never expires it.
import { asc, eq, inArray, or } from "drizzle-orm";
import { availabilityHolds, bookings, tourInstances, type AvailabilityHold, type Booking } from "../../shared/schema.js";
import type { IStorage } from "../storage.js";
import { db } from "../db.js";
import { AvailabilityService, HoldStatus, LapsedHoldUnavailableError } from "../domain/availability/availability.service.js";
import { PaymentMethodClassifier } from "../domain/payments/payment-method-classifier.js";
import { PaymentStatus } from "../domain/payments/interfaces.js";

const OPEN_PAYMENT = new Set<string>([PaymentStatus.Pending, PaymentStatus.Processing, PaymentStatus.ManualReviewRequired]);

export const SEATS_UNAVAILABLE_MESSAGE = "Couldn't reserve the seats for this booking. Check availability and try again.";

/** The booking's seats could not be reserved (full, blacked out or gone); the confirm was rolled back. */
export class SeatsUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(SEATS_UNAVAILABLE_MESSAGE);
    this.name = "SeatsUnavailableError";
    this.cause = cause;
  }
}

class RolledBack extends Error {}

/**
 * Whether a hold counts as one of the booking's seats. Session holds count only when the booking is
 * alone in its session (otherwise they may be a sibling's). Only ACTIVE or CONFIRMED holds count,
 * plus an EXPIRED hold that is the booking's own holdId (re-reserved on confirm); never RELEASED ones.
 * HoldExpiryJob uses the same rule for its session fallback.
 */
export function holdCountsForBooking(
  hold: Pick<AvailabilityHold, "id" | "status" | "bookingSessionId">,
  booking: Pick<Booking, "holdId" | "bookingSessionId">,
  aloneInSession: boolean,
): boolean {
  const own = !!booking.holdId && hold.id === booking.holdId;
  const inSession = aloneInSession && !!booking.bookingSessionId && hold.bookingSessionId === booking.bookingSessionId;
  if (!own && !inSession) return false;
  if (hold.status === HoldStatus.ACTIVE || hold.status === HoldStatus.CONFIRMED) return true;
  return hold.status === HoldStatus.EXPIRED && own;
}

/** True when no other (unarchived) booking shares the booking's session. */
export async function isAloneInSession(storage: IStorage, booking: Pick<Booking, "id" | "bookingSessionId">): Promise<boolean> {
  if (!booking.bookingSessionId) return false;
  const group = await storage.getBookingsBySession(booking.bookingSessionId);
  return group.every((b) => b.id === booking.id);
}

/**
 * Runs `write` (the booking's status write, given the transaction) together with confirming the
 * booking's seat holds, in one transaction. Locks in the gateway path's order: the booking row, then
 * its holds by id, then their tour instances by id. A lapsed (EXPIRED) hold of the booking's own is
 * re-reserved if the date is open and capacity allows; when it can't be, everything rolls back and
 * SeatsUnavailableError is thrown. Any other error rolls back and propagates as is.
 * Returns what `write` returned, or undefined (also rolled back) when `write` returned undefined
 * (a compare-and-set miss) or the booking's status is no longer `booking.status`.
 */
export async function confirmWithSeats<T>(
  storage: IStorage,
  booking: Pick<Booking, "id" | "status">,
  write: (tx: any) => Promise<T | undefined>,
): Promise<T | undefined> {
  const availability = new AvailabilityService(storage);
  try {
    return await db.transaction(async (tx: any) => {
      // 1. The booking row. It must still be in the status the caller checked.
      const [locked] = await tx.select().from(bookings).where(eq(bookings.id, booking.id)).for('update');
      if (!locked || locked.status !== booking.status) throw new RolledBack();

      // 2. Its holds, locked in id order, kept only when they count for this booking.
      const alone = await isAloneInSession(storage, locked);
      const which = [
        locked.holdId ? eq(availabilityHolds.id, locked.holdId) : undefined,
        alone && locked.bookingSessionId ? eq(availabilityHolds.bookingSessionId, locked.bookingSessionId) : undefined,
      ].filter((c) => c !== undefined);
      const rows: AvailabilityHold[] = which.length
        ? await tx.select().from(availabilityHolds).where(or(...which)).orderBy(asc(availabilityHolds.id)).for('update')
        : [];
      const holds = rows.filter((h) => holdCountsForBooking(h, locked, alone));

      // 3. Their tour instances, locked in id order.
      const instanceIds = [...new Set(holds.map((h) => h.tourInstanceId))].sort();
      if (instanceIds.length) {
        await tx.select().from(tourInstances).where(inArray(tourInstances.id, instanceIds)).orderBy(asc(tourInstances.id)).for('update');
      }

      // 4. Confirm each hold; re-reserve a lapsed one.
      for (const hold of holds) {
        if (hold.status === HoldStatus.CONFIRMED) continue;
        try {
          if (hold.status === HoldStatus.ACTIVE) await availability.confirmBooking(hold.id, tx);
          else await availability.reserveLapsedHold(hold.id, tx);
        } catch (err) {
          if (err instanceof LapsedHoldUnavailableError) throw new SeatsUnavailableError(err);
          throw err;
        }
      }

      // 5. The status write.
      const written = await write(tx);
      if (written === undefined) throw new RolledBack();
      return written;
    });
  } catch (err) {
    if (err instanceof RolledBack) return undefined;
    if (err instanceof SeatsUnavailableError) {
      console.warn(`[BOOKING][CONFIRM] Booking ${booking.id} not confirmed: seats could not be reserved:`, (err.cause as Error)?.message ?? err.cause);
    }
    throw err;
  }
}

/** Completes the booking's open offline payment (the seat holds are handled by confirmWithSeats). */
export async function completeManualConfirmation(storage: IStorage, booking: Booking): Promise<{ completedPaymentIds: string[] }> {
  const completedPaymentIds: string[] = [];
  // The open payment the admin has just checked by hand. An offline gateway's payment (bank
  // transfer, cash), or one a person was asked to review; never an online payment still with the bank.
  // No payment row (an admin confirming a booking taken by phone): payment status is left alone.
  for (const payment of await storage.getPaymentsByBooking(booking.id)) {
    if (!OPEN_PAYMENT.has(payment.status)) continue;
    const gateway = await storage.getPaymentGateway(payment.gatewayId);
    const offline = PaymentMethodClassifier.isOffline(gateway?.slug ?? "");
    if (!offline && payment.status !== PaymentStatus.ManualReviewRequired) continue;
    await storage.updatePayment(payment.id, { status: PaymentStatus.Completed });
    completedPaymentIds.push(payment.id);
  }
  return { completedPaymentIds };
}
