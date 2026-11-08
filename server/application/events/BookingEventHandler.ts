
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { PaymentConfirmed, PaymentFailed, PaymentExpired } from "../../domain/events.js";
import { IStorage } from "../../storage.js";
import { isPaidBookingStatus } from "../../domain/booking/paid-status.js";
import { AvailabilityApplicationService } from "../availability/availability.application-service.js";
import { mailingService } from "../../infrastructure/mailing/MailingService.js";
import { AuditLogService } from "../../infrastructure/audit/audit-log.service.js";
import { AtomicSessionConfirmationService } from "../booking/AtomicSessionConfirmationService.js";
import { metricsService } from "../../infrastructure/metrics/metrics.service.js";
import { confirmWithSeats } from "../../lib/manual-confirmation.js";
import { PaymentStatus } from "../../domain/payments/interfaces.js";
import type { Booking } from "../../../shared/schema.js";

export class BookingEventHandler {
  constructor(
    private storage: IStorage,
    private availabilityService: AvailabilityApplicationService
  ) { }

  public register(): void {
    eventDispatcher.subscribe(PaymentConfirmed, this.onPaymentConfirmed.bind(this));
    eventDispatcher.subscribe(PaymentFailed, this.onPaymentFailed.bind(this));
    eventDispatcher.subscribe(PaymentExpired, this.onPaymentExpired.bind(this));
  }

  private async onPaymentConfirmed(event: PaymentConfirmed): Promise<void> {
    const correlationId = event.correlationId || 'no-correlation';
    console.log(`[EVENT][HANDLER][${correlationId}] Handling PaymentConfirmed for Booking ${event.bookingId}`);

    const booking = await this.storage.getBooking(event.bookingId);
    if (!booking) {
      console.error(`[EVENT][ERROR] Booking ${event.bookingId} not found for payment confirmation`);
      return;
    }

    if (booking.status !== 'confirmed') {
      try {
        // FIX (CRIT-2): Validate against the price SNAPSHOT stored at booking creation time
        // (booking.totalAmountCents), not a live recalculation.
        //
        // Live recalculation is wrong because:
        // 1. Multi-day vehicle bookings apply a duration multiplier in CreateBookingFromCartService
        //    but the event handler previously missed it, causing false mismatches.
        // 2. Group discounts / seasonal surcharges can change between booking and webhook,
        //    so recalculating against live rules will always produce a spurious mismatch.
        //
        // The payment gateway charged exactly booking.totalAmountCents.  That is our ground
        // truth.  The only thing to verify here is that the payment amount matches it.
        const paymentRecord = await this.storage.getPayment(event.paymentId);
        const paidAmountCents = paymentRecord?.amount;
        if (typeof paidAmountCents === 'number' && paidAmountCents !== booking.totalAmountCents) {
          // Genuine mismatch: gateway charged a different amount than we expected.
          // Send admin email with in-app notification fallback
          const mismatchMsg = `Payment amount mismatch for booking ${booking.id}: snapshot ${booking.totalAmountCents} vs paid ${paidAmountCents}. Requires manual review.`;
          try {
            await mailingService.sendAdminEmail(
              `Payment Amount Mismatch: Booking ${booking.id}`,
              `<p>A payment amount mismatch was detected during payment confirmation for booking <strong>${booking.id}</strong>.</p>
               <p><strong>Customer:</strong> ${booking.customerName} (${booking.customerEmail})</p>
               <p><strong>Booking Snapshot Total:</strong> ${booking.totalAmountCents} VUV cents</p>
               <p><strong>Amount Charged by Gateway:</strong> ${paidAmountCents} VUV cents</p>
               <p>The booking has been marked as <code>price_mismatch</code> and requires manual review.</p>`
            );
          } catch (emailErr) {
            console.error(`[EVENT][CRITICAL] Failed to send price mismatch admin email — creating fallback notification`);
            // Fallback: create in-app notification so admin still sees the alert
            await this.storage.createNotification({
              type: 'error',
              title: 'CRITICAL: Payment Amount Mismatch',
              message: mismatchMsg,
              link: '/admin/bookings',
              userId: null,
            });
          }

          await this.storage.updateBooking(booking.id, { status: 'price_mismatch' });
          const audit = new AuditLogService(this.storage);
          await audit.log({ productId: booking.tourId, action: 'manual_adjustment', performedBy: 'system', metadata: { bookingId: booking.id, snapshotTotal: booking.totalAmountCents, paidAmount: paidAmountCents } });

          metricsService.incrementFailure("PRICE_MISMATCH");
          metricsService.recordErrorSnippet("PRICE_MISMATCH", `Booking ${booking.id} snapshot ${booking.totalAmountCents} vs paid ${paidAmountCents}`);
          console.error(`[PRICE][MISMATCH][${correlationId}] Booking ${booking.id} snapshot ${booking.totalAmountCents} vs paid ${paidAmountCents}`);
          return;
        }

        // ALL-OR-NOTHING SESSION CONFIRMATION (PHASE 4)
        const sessionService = new AtomicSessionConfirmationService(this.storage);
        const result = await sessionService.confirmSessionAtomically({
          sessionId: booking.bookingSessionId || 'default_session',
          paymentId: event.paymentId
        });

        if (!result.success) {
          console.error(`[SESSION_CONFIRM][FAILED] ${result.message}`, result.error);
          // The money is in. Try to re-reserve the seats (a lapsed hold can be
          // re-confirmed if capacity still exists); if that fails, a person must
          // resolve it. Never leave a completed payment silently unconfirmed.
          const recovered = await this.recoverUnconfirmedPayment(booking, event.paymentId, result.message, correlationId);
          if (!recovered) return;
        }

        if (result.wasAlreadyConfirmed) {
          console.log(`[EVENT][IDEMPOTENT][${correlationId}] Session ${booking.bookingSessionId} already confirmed. Skipping side-effects.`);
          return;
        }

        console.log(`[EVENT][SUCCESS] Booking session ${booking.bookingSessionId} confirmed atomically via PaymentConfirmed event`);

        // Trigger emails/admin notifications here (non-blocking — never delay confirmation)
        const tour = await this.storage.getProduct(booking.tourId);
        const bookingRef = (booking.id || '').replace(/^book_/i, '').replace(/-/g, '').slice(0, 8).toUpperCase();

        // Fire-and-forget: emails must not block the confirmation flow
        Promise.allSettled([
          // 1. Send Payment Receipt
          mailingService.sendPaymentSuccess(booking.customerEmail, {
            bookingId: booking.id,
            customerName: booking.customerName,
            amount: typeof booking.totalAmountCents === 'number'
              ? `${Math.round(booking.totalAmountCents).toLocaleString()} VT`
              : booking.amount,
            transactionId: event.paymentId,
            locale: booking.locale || 'en',
          }),
          // 2. Send Booking Confirmation
          mailingService.sendBookingConfirmation(booking.customerEmail, {
            id: booking.id,
            customerName: booking.customerName,
            tourName: tour?.title || 'Your Tour',
            date: booking.date,
            totalAmountCents: booking.totalAmountCents,
            amount: booking.amount,
            paymentMethod: booking.paymentMethod || undefined,
            locale: booking.locale || 'en',
          }),
          // 3. Notify Admin
          mailingService.sendAdminEmail(
            `Payment Confirmed: ACT-${bookingRef} - ${booking.customerName}`,
            `<h2>Payment Confirmed</h2>
                <p>A payment has been successfully confirmed for booking <strong>ACT-${bookingRef}</strong>.</p>
                <p><strong>Customer:</strong> ${booking.customerName} (${booking.customerEmail})</p>
                <p><strong>Tour:</strong> ${tour?.title || 'Unknown'}</p>
                <p><strong>Date:</strong> ${booking.date}</p>
                <p><strong>Amount:</strong> VT ${booking.totalAmountCents?.toLocaleString()}</p>
                <p>Login to the admin dashboard for more details.</p>`
          ),
        ]).then(results => {
          const failures = results.filter(r => r.status === 'rejected');
          if (failures.length > 0) {
            console.error(`[EVENT][EMAIL][${correlationId}] ${failures.length} email(s) failed for booking ${booking.id}:`,
              failures.map(f => (f as PromiseRejectedResult).reason?.message || f));
          }
        });
      } catch (error: any) {
        console.error(`[EVENT][ERROR][${correlationId}] Failed to confirm booking ${booking.id}:`, error);

        if (error.code === 'CAPACITY_EXCEEDED' || error.message?.includes('Capacity exceeded')) {
          // PHASE 2 FIX: Mark booking as inventory conflict instead of generic failure
          await this.storage.updateBooking(booking.id, { status: 'inventory_conflict' });

          const audit = new AuditLogService(this.storage);
          await audit.log({
            productId: booking.tourId,
            action: 'manual_adjustment',
            performedBy: 'system',
            metadata: {
              bookingId: booking.id,
              reason: 'capacity_lost_during_manual_delay',
              error: error.message
            }
          });

          metricsService.incrementFailure("INVENTORY_CONFLICT");
        } else {
          metricsService.incrementFailure("EVENT_HANDLER_FAILURE");
          metricsService.recordErrorSnippet("EVENT_HANDLER_FAILURE", error instanceof Error ? error.message : String(error));
        }
      }
    }
  }

  /**
   * A gateway says it was paid, but the normal session confirmation could not
   * finish (usually because the hold expired). Re-reserve the booking's own
   * seats where possible; otherwise flag the payment and booking for a human.
   * Returns true when the booking is now confirmed.
   */
  private async recoverUnconfirmedPayment(
    booking: Booking,
    paymentId: string,
    failureMessage: string,
    correlationId: string,
  ): Promise<boolean> {
    try {
      const confirmed = await confirmWithSeats(this.storage, booking, (tx) =>
        this.storage.updateBooking(booking.id, {
          status: "confirmed",
          paymentReference: paymentId,
          confirmedAt: new Date(),
        }, tx),
      );
      if (confirmed) {
        console.warn(`[EVENT][RECOVERED][${correlationId}] Booking ${booking.id} confirmed by re-reserving lapsed seats after payment.`);
        return true;
      }
    } catch (err: any) {
      console.error(`[EVENT][RECOVERY-FAILED][${correlationId}] Could not re-reserve seats for ${booking.id}:`, err?.message || err);
    }

    const payment = await this.storage.getPayment(paymentId);
    await this.storage.updatePayment(paymentId, {
      status: PaymentStatus.ManualReviewRequired,
      failureReason: "seats_unavailable_after_payment",
      metadata: {
        ...((payment?.metadata as Record<string, unknown>) || {}),
        confirmationFailure: failureMessage,
      },
    });

    // Never overwrite a booking that was already completed/cancelled by a person.
    if (!["completed", "cancelled"].includes(booking.status)) {
      await this.storage.updateBooking(booking.id, { status: "inventory_conflict" });
    }

    const ref = (booking.id || "").replace(/^book_/i, "").replace(/-/g, "").slice(0, 8).toUpperCase();
    const message = `Payment ${paymentId} for booking ${booking.id} was received, but its seats could not be confirmed (${failureMessage}). The payment is held for manual review; refund or re-book the guest.`;
    try {
      await this.storage.createNotification({
        type: "error",
        title: "Paid booking needs seats",
        message,
        link: "/admin/bookings",
        userId: null,
      });
    } catch (notifyErr) {
      console.error(`[EVENT][RECOVERY-NOTIFY][${correlationId}] In-app notification failed:`, notifyErr);
    }

    try {
      await mailingService.sendAdminEmail(
        `⚠️ Paid booking could not be confirmed — ACT-${ref}`,
        `<p>A gateway reported a successful payment, but the booking could not be confirmed because its seats were no longer available.</p>
         <p><strong>Booking:</strong> ACT-${ref} (${booking.id})<br>
         <strong>Payment:</strong> ${paymentId}<br>
         <strong>Customer:</strong> ${booking.customerName} (${booking.customerEmail})<br>
         <strong>Reason:</strong> ${failureMessage}</p>
         <p>The payment is <strong>manual_review_required</strong> and the booking is <strong>inventory_conflict</strong>. Refund the guest or find them seats in Admin → Bookings.</p>`,
      );
    } catch (emailErr) {
      console.error(`[EVENT][RECOVERY-EMAIL][${correlationId}] Admin alert failed:`, emailErr);
    }

    const audit = new AuditLogService(this.storage);
    await audit.log({
      productId: booking.tourId,
      action: "manual_adjustment",
      performedBy: "system",
      metadata: {
        bookingId: booking.id,
        paymentId,
        reason: "paid_but_seats_unavailable",
        failureMessage,
      },
    });

    metricsService.incrementFailure("PAID_BUT_UNCONFIRMED");
    console.error(`[EVENT][PAID-UNCONFIRMED][${correlationId}] ${message}`);
    return false;
  }

  private async onPaymentFailed(event: PaymentFailed): Promise<void> {
    const booking = await this.storage.getBooking(event.bookingId);
    if (!booking) return;

    console.log(`[EVENT][HANDLER] Handling PaymentFailed for Booking ${booking.id}`);

    await this.storage.updateBooking(booking.id, { status: 'failed' });
    await this.releaseBookingHolds(booking);

    // Non-blocking email
    mailingService.sendPaymentFailure(booking.customerEmail, {
      bookingId: booking.id,
      customerName: booking.customerName,
      amount: typeof booking.totalAmountCents === 'number'
        ? `${Math.round(booking.totalAmountCents).toLocaleString()} VT`
        : booking.amount,
      reason: event.reason,
      locale: booking.locale || 'en'
    }).catch(err => console.error(`[EVENT][EMAIL] PaymentFailed email failed for ${booking.id}:`, err));
  }

  /**
   * Frees a failed booking's seats now instead of when its holds time out, so the
   * guest can retry straight away. Bookings created before holds were keyed per
   * booking may share a group (the browser session) with other bookings; then only
   * the booking's own hold is released, never a sibling's.
   */
  private async releaseBookingHolds(booking: { id: string; holdId: string | null; bookingSessionId: string }): Promise<void> {
    const holdIds = new Set<string>(booking.holdId ? [booking.holdId] : []);
    if (booking.bookingSessionId) {
      const groupBookings = await this.storage.getBookingsBySession(booking.bookingSessionId);
      const sharedWithOthers = groupBookings.some((b) => b.id !== booking.id);
      if (!sharedWithOthers) {
        for (const hold of await this.storage.getHoldsBySession(booking.bookingSessionId)) holdIds.add(hold.id);
      }
    }
    for (const holdId of holdIds) {
      await this.availabilityService.releaseHold(holdId)
        .catch((err) => console.warn(`[EVENT][HANDLER] Could not release hold ${holdId} for failed booking ${booking.id}:`, err?.message || err));
    }
  }

  private async onPaymentExpired(event: PaymentExpired): Promise<void> {
    const booking = await this.storage.getBooking(event.bookingId);
    if (!booking) return;
    // A booking paid meanwhile (confirmed by hand) keeps its seats; any other one expires as before.
    if (isPaidBookingStatus(booking.status)) {
      console.warn(`[EVENT][HANDLER] PaymentExpired for booking ${booking.id} ignored: it is '${booking.status}'`);
      return;
    }

    console.log(`[EVENT][HANDLER] Handling PaymentExpired for Booking ${booking.id}`);

    await this.storage.updateBooking(booking.id, { status: 'cancelled' });
    // Non-blocking email
    mailingService.sendPaymentExpiry(booking.customerEmail, booking.id, booking.customerName, booking.locale || 'en')
      .catch(err => console.error(`[EVENT][EMAIL] PaymentExpired email failed for ${booking.id}:`, err));
  }
}
