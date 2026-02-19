import { IStorage } from "../../storage.js";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { PaymentInitiated, PaymentConfirmed } from "../../domain/events.js";
import { PaymentStatus } from "../../domain/payments/interfaces.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger('reconciliation-saga');

export class BankTransferReconciliationSaga {
  // LOW-7 DOC: Intentionally shorter than MANUAL_PAYMENT_TTL_MINUTES (72h).
  // The saga proactively flags overdue payments at 48h so admins can follow up.
  // The hold-expiry job at 72h is the hard deadline that releases inventory.
  private static PENDING_EXPIRY_HOURS = 48;

  constructor(private storage: IStorage) { }

  public register(): void {
    // Saga listens to events to start tracking or resolve
    eventDispatcher.subscribe(PaymentInitiated, this.onPaymentInitiated.bind(this));
    eventDispatcher.subscribe(PaymentConfirmed, this.onPaymentConfirmed.bind(this));
  }

  private async onPaymentInitiated(event: PaymentInitiated): Promise<void> {
    log.info('Starting tracking for payment', { paymentId: event.paymentId });
    // In a real saga, you might persists saga state. 
    // Here we use the Payment status as our state.
  }

  private async onPaymentConfirmed(event: PaymentConfirmed): Promise<void> {
    log.info('Resolving tracking for payment (Confirmed)', { paymentId: event.paymentId });
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

    log.info('Found overdue payments', { count: overdue.length });

    const { PaymentApplicationService } = await import("../payment.application-service.js");
    const paymentService = new PaymentApplicationService(this.storage);

    for (const payment of overdue) {
      try {
        // ORCHESTRATE: Send command to Application Service
        // The service will then load the Aggregate to check invariants
        await paymentService.expirePayment(payment.id);
      } catch (err) {
        log.error('Failed to expire payment', { paymentId: payment.id, error: (err as Error).message });
      }
    }
  }
}

