
import { IStorage } from "../storage.js";
import { PaymentFactory } from "../infrastructure/payments/factory.js";
import { PaymentStatus, type PaymentStatusResponse } from "../domain/payments/interfaces.js";
import { ReconciliationPolicy } from "../domain/payments/reconciliation.policy.js";
import { BookingConfirmationWithRetries } from "./booking/BookingConfirmationWithRetries.js";

export class PaymentReconciliationService {
  private storage: IStorage;
  private bookingConfirmation: BookingConfirmationWithRetries;

  constructor(storage: IStorage) {
    this.storage = storage;
    // Phase 4: Use BookingConfirmationWithRetries for production-grade concurrency safety
    this.bookingConfirmation = new BookingConfirmationWithRetries(storage);
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

        // Booking confirmation: Phase 4 - Use resilient confirmation with retries
        if (response.status === PaymentStatus.Completed && payment.bookingId) {
          const booking = await this.storage.getBooking(payment.bookingId);
          if (booking && booking.status === 'pending') {
            console.log(`[RECON][${traceId}] Payment ${paymentId} completed - confirming booking ${booking.id}`);
            
            // Phase 4: Use confirmWithRetries for automatic conflict recovery
            const confirmResult = await this.bookingConfirmation.confirmWithRetries({
              bookingId: booking.id,
              paymentId: paymentId,
              gatewayReference: response.gatewayReference,
              maxRetries: 3,
              idempotencyKey: `recon_${paymentId}`
            });

            if (confirmResult.success) {
              console.log(
                `[RECON][${traceId}] ✅ Booking ${booking.id} confirmed via payment completion ` +
                `(${confirmResult.retryAttempts || 0} retries, ${confirmResult.metrics?.timeMs || 0}ms)`
              );
            } else {
              console.error(
                `[RECON][${traceId}] CRITICAL: Booking confirmation failed - ` +
                `${confirmResult.error?.reason}. Details: ${confirmResult.error?.details}`
              );
              
              // Mark payment as ManualReviewRequired because booking could not be confirmed
              await this.storage.updatePayment(payment.id, {
                status: PaymentStatus.ManualReviewRequired,
                failureReason: confirmResult.error?.code || 'confirmation_failed'
              });

              // Log conflict information if available
              if (confirmResult.conflictHandling?.conflictDetected) {
                console.warn(
                  `[RECON][${traceId}] Conflict detected: ${confirmResult.conflictHandling.conflictType} ` +
                  `- Resolution: ${confirmResult.conflictHandling.resolutionStrategy}`
                );
              }

              // Keep booking pending so user can retry
              return;
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
   * Phase 4: Uses resilient confirmation with automatic retry
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
          console.log(`[RECON] Confirming booking ${booking.id} via manual override`);
          
          // Phase 4: Use resilient confirmation with automatic retry
          const confirmResult = await this.bookingConfirmation.confirmWithRetries({
            bookingId: booking.id,
            paymentId: payment.id,
            maxRetries: 3,
            idempotencyKey: `admin_recon_${paymentId}`
          });

          if (!confirmResult.success) {
            console.error(`[RECON] Manual override confirmation failed - ${confirmResult.error?.reason}`);
            throw new Error(
              `Manual reconciliation failed: ${confirmResult.error?.reason}. ` +
              `${confirmResult.error?.details || 'Hold might be expired or booking is in invalid state.'}`
            );
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
