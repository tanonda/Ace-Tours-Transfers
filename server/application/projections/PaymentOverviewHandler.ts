import { IProjectionHandler } from "../../infrastructure/projections/projection-engine";
import { PaymentInitiated, PaymentConfirmed } from "../../domain/events";
import { IStorage } from "../../storage";

export class PaymentOverviewHandler implements IProjectionHandler<any> {
  constructor(private storage: IStorage) {}

  public async handle(event: any): Promise<void> {
    const correlationId = (event as any).correlationId || 'no-correlation';

    if (event instanceof PaymentInitiated) {
      await (this.storage as any).upsertPaymentOverview({
        paymentId: event.paymentId,
        bookingId: event.bookingId,
        method: 'manual', // Default for now, can be evolved
        status: 'pending',
        amount: event.amount,
        currency: 'VUV',
      });
      console.log(`[PROJECTION][${correlationId}] Projected PaymentInitiated for Payment ${event.paymentId}`);
    } else if (event instanceof PaymentConfirmed) {
      await (this.storage as any).upsertPaymentOverview({
        paymentId: event.paymentId,
        bookingId: event.bookingId,
        method: 'manual',
        status: 'completed',
        amount: 0, // Fallback for insert, will be correctly set if PaymentInitiated happened first
        currency: 'VUV',
      });
      console.log(`[PROJECTION][${correlationId}] Projected PaymentConfirmed for Payment ${event.paymentId}`);
    }
  }
}
