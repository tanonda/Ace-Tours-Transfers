
import { IStorage } from "../storage.js";
import { PaymentFactory } from "../infrastructure/payments/factory.js";
import { PaymentStatus, type PaymentStatusResponse } from "../domain/payments/interfaces.js";
import { ReconciliationPolicy } from "../domain/payments/reconciliation.policy.js";
import { AvailabilityApplicationService } from "./availability/availability.application-service.js";

export class PaymentReconciliationService {
  private storage: IStorage;
  private availabilityService: AvailabilityApplicationService;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.availabilityService = new AvailabilityApplicationService(storage);
  }

  /**
   * Orchestrates the reconciliation of multiple stale processing payments.
   */
  async reconcileStalePayments(batchSize: number = 50): Promise<void> {
    const stalePayments = await this.storage.getStaleProcessingPayments(batchSize);
    console.log(`[RECON] Starting reconciliation for ${stalePayments.length} stale payments.`);

    for (const payment of stalePayments) {
      try {
        await this.syncPaymentStatus(payment.id);
      } catch (error) {
        console.error(`[RECON] Failed to reconcile payment ${payment.id}:`, error);
      }
    }
  }

  /**
   * Syncs a single payment's status with the gateway and updates internal records.
   */
  async syncPaymentStatus(paymentId: string): Promise<void> {
    const payment = await this.storage.getPayment(paymentId);
    if (!payment) return;

    const gateway = await this.storage.getPaymentGateway(payment.gatewayId);
    if (!gateway) return;

    const adapter = PaymentFactory.getPaymentGatewayService(gateway);
    const traceId = `trace_${Date.now()}_${paymentId.slice(0, 8)}`;

    console.log(`[RECON][${traceId}] Syncing payment ${paymentId} with gateway ${gateway.slug}.`);

    try {
      const response: PaymentStatusResponse = await adapter.queryPaymentStatus({
        paymentId: payment.id,
        gatewayReference: payment.gatewayReference || undefined
      });

      // Update reconciliation audit fields regardless of success
      await this.storage.updatePayment(payment.id, {
        lastReconciledAt: new Date(),
        reconciliationAttempts: (payment.reconciliationAttempts || 0) + 1
      });

      if (!ReconciliationPolicy.isTransitionSafe(payment.status as PaymentStatus, response.status)) {
        console.warn(`[RECON][${traceId}] Transition from ${payment.status} to ${response.status} rejected by policy.`);
        return;
      }

      // If status has changed, perform the transition
      if (payment.status !== response.status) {
        console.log(`[RECON][${traceId}] Transitioning payment ${paymentId} from ${payment.status} to ${response.status}.`);
        
        await this.storage.updatePayment(paymentId, {
          status: response.status,
          failureReason: response.status === PaymentStatus.Failed ? (response.failureReason || 'reconciliation_failed') : undefined
        });

        // Booking confirmation logic parity with Webhook handler
        if (response.status === PaymentStatus.Completed && payment.bookingId) {
          const booking = await this.storage.getBooking(payment.bookingId);
          if (booking && booking.status === 'pending') {
            if (booking.holdId) {
              try {
                await this.availabilityService.confirmBooking(booking.holdId);
                console.log(`[RECON][${traceId}] Confirmed hold ${booking.holdId} for booking ${booking.id}`);
                
                // Only confirm booking IF hold confirmation succeeded
                await this.storage.updateBooking(payment.bookingId, { status: 'confirmed' });
                console.log(`[RECON][${traceId}] Booking ${payment.bookingId} confirmed after inventory secured.`);
              } catch (holdError) {
                console.error(`[RECON][${traceId}] CRITICAL: Hold confirmation failed for booking ${booking.id}. Error:`, holdError);
                
                // Mark payment as ManualReviewRequired because inventory is NOT secured
                await this.storage.updatePayment(payment.id, {
                  status: PaymentStatus.ManualReviewRequired,
                  failureReason: 'reconciliation_inventory_failure'
                });

                // Mark booking for manual review with explicit failure state
                await this.storage.updateBooking(booking.id, { 
                  status: 'pending', 
                  paymentReference: payment.gatewayReference ? `RECON_INCONSISTENT: ${payment.gatewayReference}` : 'RECON_INCONSISTENT'
                });
              }
            } else {
              console.warn(`[RECON][${traceId}] Booking ${payment.bookingId} completed payment but has no holdId.`);
              await this.storage.updateBooking(payment.bookingId, { status: 'confirmed' });
            }
          }
        }
      } else {
        console.log(`[RECON][${traceId}] No status change detected for payment ${paymentId}.`);
      }

    } catch (error: any) {
      console.error(`[RECON][${traceId}] Error during gateway sync:`, error);
      throw error;
    }
  }

  /**
   * Manual admin-triggered reconciliation with forced audit trail.
   */
  async reconcileManually(paymentId: string, adminId: string, note: string, forceStatus?: PaymentStatus): Promise<void> {
    console.log(`[RECON] Manual reconciliation triggered for ${paymentId} by admin ${adminId}.`);
    
    const payment = await this.storage.getPayment(paymentId);
    if (!payment) throw new Error("Payment not found");

    // Idempotency: Avoid redundant reconciliation if already completed
    if (payment.status === PaymentStatus.Completed && forceStatus === PaymentStatus.Completed) {
      console.log(`[RECON] Payment ${paymentId} already completed. Skipping manual reconciliation.`);
      return;
    }

    const updateData: any = {
      reconciledBy: adminId,
      reconciliationNote: note,
      lastReconciledAt: new Date()
    };

    if (forceStatus) {
      // Manual overrides allow bypassing some safety checks but should still be logged.
      console.warn(`[RECON] Manual status override: ${payment.status} -> ${forceStatus}`);
      updateData.status = forceStatus;
      
      if (forceStatus === PaymentStatus.Completed && payment.bookingId) {
        const booking = await this.storage.getBooking(payment.bookingId);
        if (booking && booking.status === 'pending') {
          if (booking.holdId) {
            try {
              await this.availabilityService.confirmBooking(booking.holdId);
              console.log(`[RECON] Confirmed hold ${booking.holdId} for booking ${booking.id} via manual override`);
              await this.storage.updateBooking(payment.bookingId, { status: 'confirmed' });
            } catch (holdError) {
              console.error(`[RECON] Hold confirmation failed in manual override:`, holdError);
              // In manual override, we still mark the payment updated, but if hold fails, we should be careful.
              // For now, allow the admin override to stay pending if hold is dead.
              await this.storage.updateBooking(booking.id, { 
                status: 'pending', 
                paymentReference: `MANUAL_OVERRIDE_HOLD_FAILURE: ${adminId}`
              });
              throw new Error(`Manual reconciliation failed: Could not secure inventory hold ${booking.holdId}. Hold might be expired.`);
            }
          } else {
            await this.storage.updateBooking(payment.bookingId, { status: 'confirmed' });
          }
        }
      }
    } else {
      // If no status provided, just perform a sync
      await this.syncPaymentStatus(paymentId);
    }

    await this.storage.updatePayment(paymentId, updateData);
  }
}
