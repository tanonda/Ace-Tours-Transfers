
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { PaymentConfirmed, PaymentFailed, PaymentExpired } from "../../domain/events.js";
import { IStorage } from "../../storage.js";
import { AvailabilityApplicationService } from "../availability/availability.application-service.js";
import { mailingService } from "../../infrastructure/mailing/MailingService.js";
import { AuditLogService } from "../../infrastructure/audit/audit-log.service.js";
import { AtomicSessionConfirmationService } from "../booking/AtomicSessionConfirmationService.js";
import { metricsService } from "../../infrastructure/metrics/metrics.service.js";

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
          await mailingService.sendAdminEmail(
            `🚨 Payment Amount Mismatch: Booking ${booking.id}`,
            `<p>A payment amount mismatch was detected during payment confirmation for booking <strong>${booking.id}</strong>.</p>
             <p><strong>Customer:</strong> ${booking.customerName} (${booking.customerEmail})</p>
             <p><strong>Booking Snapshot Total:</strong> ${booking.totalAmountCents} VUV cents</p>
             <p><strong>Amount Charged by Gateway:</strong> ${paidAmountCents} VUV cents</p>
             <p>The booking has been marked as <code>price_mismatch</code> and requires manual review.</p>`
          );

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
          return;
        }

        if (result.wasAlreadyConfirmed) {
          console.log(`[EVENT][IDEMPOTENT][${correlationId}] Session ${booking.bookingSessionId} already confirmed. Skipping side-effects.`);
          return;
        }

        console.log(`[EVENT][SUCCESS] Booking session ${booking.bookingSessionId} confirmed atomically via PaymentConfirmed event`);

        // Trigger emails/admin notifications here
        const tour = await this.storage.getProduct(booking.tourId);

        // 1. Send Payment Receipt (branded template via MailingService)
        await mailingService.sendPaymentSuccess(booking.customerEmail, {
          bookingId: booking.id,
          customerName: booking.customerName,
          amount: typeof booking.totalAmountCents === 'number'
            ? `${Math.round(booking.totalAmountCents).toLocaleString()} VT`
            : booking.amount,
          transactionId: event.paymentId,
          locale: booking.locale || 'en',
        });

        // 2. Send Booking Confirmation (branded template via MailingService)
        await mailingService.sendBookingConfirmation(booking.customerEmail, {
          id: booking.id,
          customerName: booking.customerName,
          tourName: tour?.title || 'Your Tour',
          date: booking.date,
          totalAmountCents: booking.totalAmountCents,
          amount: booking.amount,
          paymentMethod: booking.paymentMethod || undefined,
          locale: booking.locale || 'en',
        });

        // 3. Notify Admin of confirmed booking
        try {
          await mailingService.sendAdminEmail(
            `✅ Payment Confirmed: ACT-${(booking.id || '').replace(/^book_/i, '').replace(/-/g, '').slice(0, 8).toUpperCase()} - ${booking.customerName}`,
            `<h2>Payment Confirmed</h2>
                <p>A payment has been successfully confirmed for booking <strong>ACT-${(booking.id || '').replace(/^book_/i, '').replace(/-/g, '').slice(0, 8).toUpperCase()}</strong>.</p>
                <p><strong>Customer:</strong> ${booking.customerName} (${booking.customerEmail})</p>
                <p><strong>Tour:</strong> ${tour?.title || 'Unknown'}</p>
                <p><strong>Date:</strong> ${booking.date}</p>
                <p><strong>Amount:</strong> VT ${booking.totalAmountCents?.toLocaleString()}</p>
                <p>Login to the admin dashboard for more details.</p>`
          );
        } catch (adminErr) {
          console.error(`[EVENT][ERROR][${correlationId}] Failed to send admin payment confirmation email:`, adminErr);
        }
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

  private async onPaymentFailed(event: PaymentFailed): Promise<void> {
    const booking = await this.storage.getBooking(event.bookingId);
    if (!booking) return;

    console.log(`[EVENT][HANDLER] Handling PaymentFailed for Booking ${booking.id}`);

    await this.storage.updateBooking(booking.id, { status: 'failed' });

    await mailingService.sendPaymentFailure(booking.customerEmail, {
      bookingId: booking.id,
      customerName: booking.customerName,
      amount: typeof booking.totalAmountCents === 'number'
        ? `${Math.round(booking.totalAmountCents).toLocaleString()} VT`
        : booking.amount,
      reason: event.reason,
      locale: booking.locale || 'en'
    });
  }

  private async onPaymentExpired(event: PaymentExpired): Promise<void> {
    const booking = await this.storage.getBooking(event.bookingId);
    if (!booking) return;

    console.log(`[EVENT][HANDLER] Handling PaymentExpired for Booking ${booking.id}`);

    await this.storage.updateBooking(booking.id, { status: 'cancelled' });
    await mailingService.sendPaymentExpiry(booking.customerEmail, booking.id, booking.customerName, booking.locale || 'en');
  }
}
