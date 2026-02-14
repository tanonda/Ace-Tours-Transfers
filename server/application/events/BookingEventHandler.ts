
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { PaymentConfirmed, PaymentFailed, PaymentExpired } from "../../domain/events.js";
import { IStorage } from "../../storage.js";
import { AvailabilityApplicationService } from "../availability/availability.application-service.js";
import { mailingService } from "../../infrastructure/mailing/MailingService.js";
import { PricingEngine } from "../../domain/pricing/PricingEngine.js";
import { AuditLogService } from "../../infrastructure/audit/audit-log.service.js";

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
            item.addonIds
          );
          
          expectedTotal += pricing.breakdown.finalTotalCents * (item.quantity || 1);
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
