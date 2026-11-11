
import { IStorage } from "../storage.js";
import { PaymentFactory } from "../infrastructure/payments/factory.js";
import { PaymentStatus, type PaymentStatusResponse } from "../domain/payments/interfaces.js";
import { PaymentIntent, PaymentIntentStatus } from "../domain/payments/PaymentIntent.js";
import { ReconciliationPolicy } from "../domain/payments/reconciliation.policy.js";
import { sendEmail, sendAdminEmail, getPaymentConfirmationTemplate, getBookingConfirmedTemplate, shortBookingRef } from "../lib/mail.js";
import { escapeHtml } from "../lib/escape-html.js";
import type { Payment, PaymentGateway } from "../../shared/schema.js";
import { holdPaymentForReview, BANK_STATUS_NEEDS_REVIEW } from "./payment-review.js";

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

    const adapter = PaymentFactory.getPaymentGatewayService(gateway, 'existing');
    const traceId = `trace_${Date.now()}_${paymentId.slice(0, 8)}`;

    // Notification-only gateways (PayZen) have no status-query API. Polling them
    // throws forever, so a missed IPN would leave a charged guest's payment in
    // `processing` with no alert. Route it to manual review instead.
    if (adapter.supportsStatusQuery?.() === false) {
      await this.handleMissedNotification(payment, gateway, traceId, auditFields);
      return;
    }

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

      // The gateway has nothing final and the payment's window (card checkout, or a
      // payment link's life) is over: expire it rather than polling it forever.
      const stillOpen = [PaymentStatus.Pending, PaymentStatus.Processing].includes(response.status);
      if (stillOpen && payment.expiresAt && payment.expiresAt < new Date()) {
        console.log(`[RECON][${traceId}] Payment ${paymentId} expired with no result at the gateway.`);
        await this.storage.updatePayment(paymentId, { status: PaymentStatus.Expired, failureReason: 'expired_timeout' });
        new PaymentIntent({
          id: payment.id,
          bookingId: payment.bookingId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status as any,
          method: 'Card',
          provider: gateway.slug,
        }).fail('expired_timeout');
        return;
      }

      if (!ReconciliationPolicy.isTransitionSafe(payment.status as PaymentStatus, response.status)) {
        console.warn(`[RECON][${traceId}] Transition from ${payment.status} to ${response.status} rejected by policy.`);
        return;
      }

      // The bank holds the money or reports something only a person can settle:
      // park it with a review window and an admin alert, never silently.
      if (response.status === PaymentStatus.ManualReviewRequired) {
        if (payment.status !== PaymentStatus.ManualReviewRequired) {
          await holdPaymentForReview(this.storage, payment, {
            reason: BANK_STATUS_NEEDS_REVIEW,
            gatewayName: gateway.displayName,
            detail: response.message,
            gatewayReference: response.gatewayReference,
            bankAmount: response.amount,
            bankCurrency: response.currency,
          });
        }
        return;
      }

      // Same rule as the callback path: a "paid" for another amount or currency
      // never confirms a booking.
      const wrongAmount = response.amount !== undefined && response.amount !== payment.amount;
      const wrongCurrency = response.currency !== undefined && response.currency !== payment.currency;
      if (response.status === PaymentStatus.Completed && (wrongAmount || wrongCurrency)) {
        console.error(`[RECON][${traceId}] Payment ${paymentId} captured as ${response.amount} ${response.currency}, expected ${payment.amount} ${payment.currency}.`);
        await holdPaymentForReview(this.storage, payment, {
          reason: 'amount_currency_mismatch',
          gatewayName: gateway.displayName,
          detail: `Captured ${response.amount} ${response.currency}, expected ${payment.amount} ${payment.currency}`,
          gatewayReference: response.gatewayReference,
          bankAmount: response.amount,
          bankCurrency: response.currency,
        });
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
   * A gateway that only reports by notification (PayZen) can be charged with no
   * IPN reaching us (guest closed the tab, bank retry exhausted, notification URL
   * misconfigured). While the payment window is still open we simply wait; once it
   * has passed, the payment is held for manual review and an admin is emailed, so
   * the guest is never silently left charged with an "expired" record.
   */
  private async handleMissedNotification(
    payment: Payment,
    gateway: PaymentGateway,
    traceId: string,
    auditFields?: { reconciledBy?: string; reconciliationNote?: string },
  ): Promise<void> {
    const now = new Date();

    // Only a payment still waiting for its notification can be missed. A completed,
    // refunded, failed or already-reviewed payment must not be moved back to
    // review by an admin pressing "sync".
    if (payment.status !== PaymentStatus.Processing) {
      await this.storage.updatePayment(payment.id, {
        lastReconciledAt: now,
        reconciliationAttempts: (payment.reconciliationAttempts || 0) + 1,
        ...(auditFields || {}),
      });
      console.log(`[RECON][${traceId}] ${gateway.slug} is notification-only and payment ${payment.id} is ${payment.status}; no recovery needed.`);
      return;
    }

    const windowOver = !!payment.expiresAt && new Date(payment.expiresAt).getTime() < now.getTime();

    const update: Record<string, any> = {
      lastReconciledAt: now,
      reconciliationAttempts: (payment.reconciliationAttempts || 0) + 1,
      ...(auditFields || {}),
    };

    if (!windowOver) {
      // Still inside the checkout window: the IPN may simply be late.
      await this.storage.updatePayment(payment.id, update);
      console.log(`[RECON][${traceId}] ${gateway.slug} is notification-only; payment ${payment.id} still inside its window, waiting for the IPN.`);
      return;
    }

    // Give an admin time to check the bank portal without the expiry saga closing
    // the booking the next time it runs. If it is not resolved, the normal expiry
    // path eventually closes the still-pending booking.
    const reviewUntil = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    await this.storage.updatePayment(payment.id, {
      ...update,
      status: PaymentStatus.ManualReviewRequired,
      failureReason: 'ipn_not_received',
      expiresAt: reviewUntil,
    });

    console.warn(`[RECON][${traceId}] No ${gateway.slug} notification for payment ${payment.id}; held for manual review until ${reviewUntil.toISOString()}.`);

    try {
      await sendAdminEmail(
        `Payment needs review — no bank notification for ACT-${shortBookingRef(payment.bookingId)}`,
        `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #c0392b;">No bank notification received</h2>
          <p>The site did not receive a ${escapeHtml(gateway.displayName)} notification for a card payment, and this gateway does not support status polling.
          The payment is now held for <strong>manual review</strong>.</p>
          <p><strong>Payment ID:</strong> ${escapeHtml(payment.id)}<br>
          <strong>Booking:</strong> ACT-${escapeHtml(shortBookingRef(payment.bookingId))}<br>
          <strong>Amount:</strong> ${escapeHtml(String(payment.amount))} ${escapeHtml(payment.currency)}<br>
          <strong>Gateway reference:</strong> ${escapeHtml(payment.gatewayReference || 'n/a')}</p>
          <p>Check the ${escapeHtml(gateway.displayName)} Back Office for this order:</p>
          <ul>
            <li>If the card was not charged, expire the payment (the booking is still pending).</li>
            <li>If the card was charged, confirm the payment manually so the guest gets their booking.</li>
            <li>If the money must be returned, refund it in the bank portal and then record the refund here.</li>
          </ul>
          <p>The payment is held for 72 hours; if no admin resolves it, the normal expiry path closes the still-pending booking.</p>
        </div>`,
      );
    } catch (emailErr) {
      console.error('[RECON] Failed to send missed-notification email:', emailErr);
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

      // Card refunds are executed in the bank's portal, not by the site. Recording
      // one here keeps the ledger truthful: it marks the full amount refunded.
      if (forceStatus === PaymentStatus.Refunded) {
        const alreadyRefunded = payment.refundedAmount || 0;
        updateData.refundedAmount = Math.max(alreadyRefunded, payment.amount);
        updateData.refundedAt = new Date();
        updateData.refundReference = payment.refundReference || note;
        updateData.failureReason = null;
      }

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
