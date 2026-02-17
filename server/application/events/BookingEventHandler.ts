
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { PaymentConfirmed, PaymentFailed, PaymentExpired } from "../../domain/events.js";
import { IStorage } from "../../storage.js";
import { AvailabilityApplicationService } from "../availability/availability.application-service.js";
import { mailingService } from "../../infrastructure/mailing/MailingService.js";
import { PricingEngine } from "../../domain/pricing/PricingEngine.js";
import { AuditLogService } from "../../infrastructure/audit/audit-log.service.js";
import { AtomicSessionConfirmationService } from "../booking/AtomicSessionConfirmationService.js";
import { metricsService } from "../../infrastructure/metrics/metrics.service.js";

export class BookingEventHandler {
  private pricingEngine: PricingEngine;

  constructor(
    private storage: IStorage,
    private availabilityService: AvailabilityApplicationService
  ) {
    this.pricingEngine = new PricingEngine(storage);
  }

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
        // Phase 2B: Recalculate price server-side using PricingEngine and reject if mismatch
        const items = await this.storage.getBookingItems(booking.id);
        let expectedTotal = 0;

        for (const item of items) {
          const rates = await this.pricingEngine.getTourRate(item.productId, booking.date);
          if (!rates) {
            console.error(`[PRICE][ERROR] Missing rates for ${item.productId}`);
            throw new Error("Pricing unavailable");
          }

          // Use PricingEngine for complete calculation
          const pricing = await this.pricingEngine.calculateLineItem(
            item.adultPax,
            item.childPax,
            rates,
            booking.date,
            (item as any).addonIds
          );

          expectedTotal += pricing.breakdown.finalTotalCents * (item.quantity || 1);
        }

        if (expectedTotal !== booking.totalAmountCents) {
          // Price mismatch: mark booking and alert admins, do not confirm inventory
          await this.storage.updateBooking(booking.id, { status: 'price_mismatch' });
          const audit = new AuditLogService(this.storage);
          await audit.log({ productId: booking.tourId, action: 'manual_adjustment', performedBy: 'system', metadata: { bookingId: booking.id, expectedTotal, actualTotal: booking.totalAmountCents } });

          metricsService.incrementFailure("PRICE_MISMATCH");
          metricsService.recordErrorSnippet("PRICE_MISMATCH", `Booking ${booking.id} expected ${expectedTotal} vs actual ${booking.totalAmountCents}`);

          console.error(`[PRICE][MISMATCH][${correlationId}] Booking ${booking.id} expected ${expectedTotal} vs actual ${booking.totalAmountCents}`);
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
        const tour = await this.storage.getTour(booking.tourId);

        // 1. Send Payment Receipt
        await mailingService.sendPaymentSuccess(booking.customerEmail, {
          bookingId: booking.id,
          amount: booking.amount,
        });

        // 2. Send Booking Confirmation
        await mailingService.sendBookingConfirmation(booking.customerEmail, {
          id: booking.id,
          customerName: booking.customerName,
          tourName: tour?.title || 'Your Tour',
          date: booking.date,
          amount: booking.amount
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

  private async onPaymentFailed(event: PaymentFailed): Promise<void> {
    const booking = await this.storage.getBooking(event.bookingId);
    if (!booking) return;

    console.log(`[EVENT][HANDLER] Handling PaymentFailed for Booking ${booking.id}`);

    await mailingService.sendPaymentFailure(booking.customerEmail, {
      bookingId: booking.id,
      reason: event.reason
    });
  }

  private async onPaymentExpired(event: PaymentExpired): Promise<void> {
    const booking = await this.storage.getBooking(event.bookingId);
    if (!booking) return;

    console.log(`[EVENT][HANDLER] Handling PaymentExpired for Booking ${booking.id}`);

    await mailingService.sendPaymentExpiry(booking.customerEmail, booking.id);
  }
}
