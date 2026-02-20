
import { IStorage } from "../storage.js";
import { PaymentFactory } from "../infrastructure/payments/factory.js";
import { PaymentStatus, type PaymentStatusResponse } from "../domain/payments/interfaces.js";
import { PaymentIntent, PaymentIntentStatus } from "../domain/payments/PaymentIntent.js";
import { ReconciliationPolicy } from "../domain/payments/reconciliation.policy.js";
import { sendEmail, sendAdminEmail, getPaymentConfirmationTemplate, getBookingConfirmedTemplate } from "../lib/mail.js";

export class PaymentReconciliationService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
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
   * @param auditFields Optional metadata for manual reconciliation tracking
   */
  async syncPaymentStatus(paymentId: string, auditFields?: { reconciledBy?: string, reconciliationNote?: string }): Promise<void> {
    const payment = await this.storage.getPayment(paymentId);
    if (!payment) return;

    const gateway = await this.storage.getPaymentGateway(payment.gatewayId);
    if (!gateway) return;

    // Offline gateways (bank transfer, cash) have no remote status to query —
    // they are reconciled exclusively by admin action. Skip automated sync for these.
    const { PaymentMethodClassifier } = await import("../domain/payments/payment-method-classifier.js");
    if (PaymentMethodClassifier.isOffline(gateway.slug)) {
      console.log(`[RECON] Skipping automated sync for manual gateway '${gateway.slug}' (payment ${paymentId}). Use admin reconciliation.`);
      if (auditFields) {
        // Still record the audit trail if called from manual admin reconcile
        await this.storage.updatePayment(paymentId, {
          lastReconciledAt: new Date(),
          reconciliationAttempts: (payment.reconciliationAttempts || 0) + 1,
          ...auditFields,
        });
      }
      return;
    }

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
        reconciliationAttempts: (payment.reconciliationAttempts || 0) + 1,
        ...(auditFields || {})
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
          failureReason: response.status === PaymentStatus.Failed ? (response.failureReason || 'reconciliation_failed') : undefined,
          gatewayReference: response.gatewayReference
        });

        if (response.status === PaymentStatus.Completed) {
          // ✅ DELEGATE TO DOMAIN: Use PaymentIntent to emit canonical PaymentConfirmed event
          try {
            const intent = new PaymentIntent({
              id: payment.id,
              bookingId: payment.bookingId,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status as any,
              method: gateway.slug === 'stripe' ? 'Card' : 'Manual',
              provider: gateway.slug
            });

            intent.receive(); // Emits PaymentConfirmed
            console.log(`[RECON][${traceId}] Automatic sync dispatched PaymentConfirmed for ${paymentId}.`);
          } catch (eventErr) {
            console.error(`[RECON][${traceId}] Failed to dispatch sync event:`, eventErr);
          }
        }
      }
      else {
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

      await this.storage.updatePayment(paymentId, updateData);

      if (forceStatus === PaymentStatus.Completed) {
        // ✅ DELEGATE TO DOMAIN: Use PaymentIntent to emit canonical PaymentConfirmed event
        // This triggers BookingEventHandler which handles session-level atomic confirmation and emails.
        try {
          const gateway = await this.storage.getPaymentGateway(payment.gatewayId);
          const intent = new PaymentIntent({
            id: payment.id,
            bookingId: payment.bookingId,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status as any, // Transitioning FROM its current status
            method: gateway?.slug === 'stripe' ? 'Card' : 'Manual',
            provider: gateway?.slug || 'unknown'
          });

          intent.receive(); // Emits PaymentConfirmed
          console.log(`[RECON] Manual reconciliation dispatched PaymentConfirmed for ${paymentId}.`);
        } catch (eventErr) {
          console.error(`[RECON] Failed to dispatch reconcile event for ${paymentId}:`, eventErr);
          // DB is already updated above
        }
      }
    } else {
      // If no status provided, just perform a sync with the provided audit metadata
      await this.syncPaymentStatus(paymentId, {
        reconciledBy: adminId,
        reconciliationNote: note
      });
    }
  }
}
