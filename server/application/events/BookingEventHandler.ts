
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { PaymentConfirmed, PaymentFailed, PaymentExpired } from "../../domain/events.js";
import { IStorage } from "../../storage.js";
import { AvailabilityApplicationService } from "../availability/availability.application-service.js";
import { mailingService } from "../../infrastructure/mailing/MailingService.js";
// Note: PriceResolver implementation lives in domain/pricing/PriceResolver
import { PriceResolver as DomainPriceResolver } from "../../domain/pricing/PriceResolver.js";
import { AuditLogService } from "../../infrastructure/audit/audit-log.service.js";

export class BookingEventHandler {
  constructor(
    private storage: IStorage,
    private availabilityService: AvailabilityApplicationService
  ) {}

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
        // Phase 5: Recalculate price server-side and reject if mismatch
        const priceResolver = new DomainPriceResolver(this.storage as any);
        const items = await this.storage.getBookingItems(booking.id);
        let expectedTotal = 0;
        for (const item of items) {
          const rates = await priceResolver.getTourRate(item.productId, booking.date);
          if (!rates) {
            console.error(`[PRICE][ERROR] Missing rates for ${item.productId}`);
            throw new Error("Pricing unavailable");
          }
          expectedTotal += priceResolver.calculateItemTotal(item.adultPax, item.childPax, rates, 0, booking.date) * (item.quantity || 1);
        }
        if (expectedTotal !== booking.totalAmountCents) {
          // Price mismatch: mark booking and alert admins, do not confirm inventory
          await this.storage.updateBooking(booking.id, { status: 'price_mismatch' });
          const audit = new AuditLogService(this.storage);
          await audit.log({ productId: booking.tourId, action: 'manual_adjustment', performedBy: 'system', metadata: { bookingId: booking.id, expectedTotal, actualTotal: booking.totalAmountCents } });
          console.error(`[PRICE][MISMATCH] Booking ${booking.id} expected ${expectedTotal} vs actual ${booking.totalAmountCents}`);
          return;
        }
        // Secure Inventory if session exists
        if (booking.bookingSessionId) {
          await this.availabilityService.confirmSessionHolds(booking.bookingSessionId);
        } else if (booking.holdId) {
          // Fallback for legacy data/direct hold links
          await this.availabilityService.confirmBooking(booking.holdId);
        }

        // Update Booking Status
        await this.storage.updateBooking(booking.id, { status: 'confirmed' });
        console.log(`[EVENT][SUCCESS] Booking ${booking.id} confirmed via PaymentConfirmed event`);
        
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
      } catch (error) {
        console.error(`[EVENT][ERROR] Failed to confirm booking ${booking.id}:`, error);
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
