import { IStorage } from "../../storage.js";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { PaymentInitiated, PaymentConfirmed } from "../../domain/events.js";
import { PaymentStatus } from "../../domain/payments/interfaces.js";

export class BankTransferReconciliationSaga {
  private static PENDING_EXPIRY_HOURS = 48;

  constructor(private storage: IStorage) { }

  public register(): void {
    // Saga listens to events to start tracking or resolve
    eventDispatcher.subscribe(PaymentInitiated, this.onPaymentInitiated.bind(this));
    eventDispatcher.subscribe(PaymentConfirmed, this.onPaymentConfirmed.bind(this));
  }

  private async onPaymentInitiated(event: PaymentInitiated): Promise<void> {
    console.log(`[SAGA] Starting tracking for Payment ${event.paymentId}`);
    // In a real saga, you might persists saga state. 
    // Here we use the Payment status as our state.
  }

  private async onPaymentConfirmed(event: PaymentConfirmed): Promise<void> {
    console.log(`[SAGA] Resolving tracking for Payment ${event.paymentId} (Confirmed)`);
  }

  /**
   * Periodic check for overdue payments.
   * Can be called by external scheduler (e.g., Cron).
   * Strictly idempotent: Only triggers actions for payments in a valid state.
   */
  public async checkAndExpireOverduePayments(): Promise<void> {
    const now = new Date();

    // FETCH: Use targeted storage method instead of full table scan (M6 Fix)
    const overdue = await this.storage.getOverduePayments();

    if (overdue.length === 0) return;

    console.log(`[SAGA] Found ${overdue.length} overdue payments. Orchestrating expiration.`);

    const { PaymentApplicationService } = await import("../payment.application-service.js");
    const paymentService = new PaymentApplicationService(this.storage);

    for (const payment of overdue) {
      try {
        // ORCHESTRATE: Send command to Application Service
        // The service will then load the Aggregate to check invariants
        await paymentService.expirePayment(payment.id);
      } catch (err) {
        console.error(`[SAGA][ERROR] Failed to expire payment ${payment.id}:`, err);
      }
    }
  }
}

