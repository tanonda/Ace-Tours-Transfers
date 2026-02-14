
import { PricingService, PriceSnapshot } from "../../domain/pricing/PricingService.js";
import { IStorage } from "../../storage.js";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { CartPriced } from "../../domain/events.js";
import { PricingEngine } from "../../domain/pricing/PricingEngine.js";

export class PriceCartService {
  private pricingEngine: PricingEngine;

  constructor(private storage: IStorage) {
    this.pricingEngine = new PricingEngine(storage);
  }

  async priceCart(
    cartId: string,
    items: { productId: string; adultPax: number; childPax: number; date?: string; quantity?: number; addonIds?: string[] }[]
  ): Promise<PriceSnapshot> {
    const pricedItems = await Promise.all(items.map(async item => {
      const product = await this.storage.getTour(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const rates = await this.pricingEngine.getTourRate(item.productId, item.date);
      if (!rates) {
        throw new Error(`Rates for product ${item.productId} not found`);
      }

      // Use PricingEngine for complete pricing calculation with breakdown
      // This consolidates: base pricing + add-ons + group discounts + seasonal surcharges
      const pricing = await this.pricingEngine.calculateLineItem(
        item.adultPax,
        item.childPax,
        rates,
        item.date,
        item.addonIds
      );

      // Get subtotal with all rules applied
      let subtotalCents = pricing.breakdown.finalTotalCents;

      // If it's a vehicle (or any duration-based product), multiply by quantity (days)
      const duration = (product.category === 'vehicle') ? (item.quantity || 1) : 1;
      subtotalCents *= duration;

      const totalQuantityCount = item.adultPax + item.childPax;
      const unitPriceCents = totalQuantityCount > 0 ? Math.round(subtotalCents / totalQuantityCount) : 0;

      return {
        unitPriceCents,
        adultPax: item.adultPax,
        childPax: item.childPax,
        productId: product.id,
        name: product.title,
        quantity: totalQuantityCount,
        // Store pricing breakdown for audit trail
        pricingBreakdown: pricing.breakdown
      };
    }));

    const snapshot = PricingService.createSnapshot(pricedItems);

    // Emit Domain Event
    await eventDispatcher.dispatch(new CartPriced(cartId, snapshot.totalCents, snapshot.vatAmountCents));

    return snapshot;
  }
}
