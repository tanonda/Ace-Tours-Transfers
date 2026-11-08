/**
 * Seat release for a booking.
 *
 * Confirming a booking turns ACTIVE holds into CONFIRMED seats; cancelling or
 * deleting it must undo that. Before this module, cancellation only released
 * ACTIVE holds, so cancelling a confirmed booking left `confirmedCount` inflated
 * forever (phantom sold-out seats). Both ACTIVE and CONFIRMED holds are handled
 * here, in the caller's transaction, with the same lock order as confirmation
 * (booking, holds, instances).
 */

import { asc, eq, inArray, or, sql } from "drizzle-orm";
import {
  availabilityHolds,
  bookings,
  tourInstances,
  type AvailabilityHold,
  type Booking,
  type InsertBooking,
} from "../../shared/schema.js";
import { db } from "../db.js";

export interface SeatReleaseResult {
  releasedHolds: number;
  releasedSeats: number;
}

/** Locks and releases every hold of `booking`; runs inside the caller's transaction. */
export async function releaseBookingSeatsInTransaction(tx: any, booking: Booking): Promise<SeatReleaseResult> {
  // Modern bookings own their session id (= booking id). Older bookings shared a
  // browser session; in that case only the booking's own holdId belongs to it.
  const ownSession = !!booking.bookingSessionId && booking.bookingSessionId === booking.id;
  const conditions = [
    booking.holdId ? eq(availabilityHolds.id, booking.holdId) : undefined,
    ownSession ? eq(availabilityHolds.bookingSessionId, booking.bookingSessionId) : undefined,
  ].filter((condition) => condition !== undefined);

  if (conditions.length === 0) return { releasedHolds: 0, releasedSeats: 0 };

  const holds: AvailabilityHold[] = await tx
    .select()
    .from(availabilityHolds)
    .where(or(...conditions))
    .orderBy(asc(availabilityHolds.id))
    .for("update");

  if (holds.length === 0) return { releasedHolds: 0, releasedSeats: 0 };

  // Lock every affected instance in id order before touching counts.
  const instanceIds = [...new Set(holds.map((hold) => hold.tourInstanceId))].sort();
  await tx
    .select()
    .from(tourInstances)
    .where(inArray(tourInstances.id, instanceIds))
    .orderBy(asc(tourInstances.id))
    .for("update");

  let releasedHolds = 0;
  let releasedSeats = 0;

  for (const hold of holds) {
    if (hold.status !== "ACTIVE" && hold.status !== "CONFIRMED") continue;

    if (hold.status === "ACTIVE") {
      await tx
        .update(tourInstances)
        .set({ heldCount: sql`GREATEST(0, ${tourInstances.heldCount} - ${hold.quantity})`, updatedAt: new Date() })
        .where(eq(tourInstances.id, hold.tourInstanceId));
    } else {
      await tx
        .update(tourInstances)
        .set({ confirmedCount: sql`GREATEST(0, ${tourInstances.confirmedCount} - ${hold.quantity})`, updatedAt: new Date() })
        .where(eq(tourInstances.id, hold.tourInstanceId));
    }

    await tx.update(availabilityHolds).set({ status: "RELEASED" }).where(eq(availabilityHolds.id, hold.id));
    releasedHolds++;
    releasedSeats += hold.quantity;
  }

  return { releasedHolds, releasedSeats };
}

/**
 * Cancels a booking and releases its seats atomically. Any other fields in
 * `updates` are written in the same transaction.
 */
export async function cancelBookingWithSeats(
  booking: Pick<Booking, "id">,
  updates: Partial<InsertBooking> = {},
): Promise<Booking> {
  return db.transaction(async (tx: any) => {
    const [locked] = await tx.select().from(bookings).where(eq(bookings.id, booking.id)).for("update");
    if (!locked) throw new Error(`Booking ${booking.id} not found`);

    await releaseBookingSeatsInTransaction(tx, locked);

    const [updated] = await tx
      .update(bookings)
      .set({ ...updates, status: "cancelled", updatedAt: new Date() })
      .where(eq(bookings.id, booking.id))
      .returning();

    return updated;
  });
}
