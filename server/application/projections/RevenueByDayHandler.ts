import { IProjectionHandler } from "../../infrastructure/projections/projection-engine";
import { PaymentConfirmed } from "../../domain/events";
import { IStorage } from "../../storage";
import { PricingService } from "../../domain/pricing/PricingService";

export class RevenueByDayHandler implements IProjectionHandler<PaymentConfirmed> {
  constructor(private storage: IStorage) {}

  public async handle(event: PaymentConfirmed): Promise<void> {
    const correlationId = event.correlationId || 'no-correlation';
    
    const payment = await this.storage.getPayment(event.paymentId);
    if (!payment) return;

    const dateStr = payment.createdAt.toISOString().split('T')[0];
    const vatAmount = PricingService.calculateVAT(payment.amount);

    await (this.storage as any).incrementDailyRevenue(dateStr, payment.amount, vatAmount);
    console.log(`[PROJECTION][${correlationId}] Projected Revenue for ${dateStr}: +${payment.amount}`);
  }
}
