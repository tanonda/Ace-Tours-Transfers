import { IProjectionHandler } from "../../infrastructure/projections/projection-engine.js";
import { PaymentConfirmed } from "../../domain/events.js";
import { IStorage } from "../../storage.js";
import { PricingService } from "../../domain/pricing/PricingService.js";
import { PricingEngine } from "../../domain/pricing/PricingEngine.js";

export class RevenueByDayHandler implements IProjectionHandler<PaymentConfirmed> {
  constructor(private storage: IStorage) {}

  public async handle(event: PaymentConfirmed): Promise<void> {
    const correlationId = event.correlationId || 'no-correlation';
    
    const payment = await this.storage.getPayment(event.paymentId);
    if (!payment) return;

    const dateStr = payment.createdAt.toISOString().split('T')[0];
    // payment.amount is what the customer paid; its VAT share follows Admin → Pricing.
    const rules = await new PricingEngine(this.storage).getPricingRules();
    const vatAmount = PricingService.calculateVAT(payment.amount, rules);

    await (this.storage as any).incrementDailyRevenue(dateStr, payment.amount, vatAmount);
    console.log(`[PROJECTION][${correlationId}] Projected Revenue for ${dateStr}: +${payment.amount}`);
  }
}
