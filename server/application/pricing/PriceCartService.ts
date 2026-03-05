
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
      const product = await this.storage.getProduct(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const rates = await this.pricingEngine.getTourRate(item.productId, item.date);
      if (!rates) {
        throw new Error(`Rates for product ${item.productId} not found`);
      }

      // Use PricingEngine for complete pricing calculation with breakdown.
      // Handles: base pricing + add-ons + group discounts + seasonal surcharges.
      // For group-priced products, PricingEngine uses the flat groupPriceCents as base.
      const pricing = await this.pricingEngine.calculateLineItem(
        item.adultPax,
        item.childPax,
        rates,
        item.date,
        item.addonIds
      );

      // Get subtotal with all rules applied
      let subtotalCents = pricing.breakdown.finalTotalCents;

      // For vehicles (duration-based), multiply by quantity (days hired)
      const duration = (product.category === 'vehicle') ? (item.quantity || 1) : 1;
      subtotalCents *= duration;

      const isGroupPriced = rates.pricingType === 'group';
      const totalQuantityCount = item.adultPax + item.childPax;

      // unitPriceCents semantics differ by pricing model:
      //   per_person — price per individual guest (subtotal ÷ pax)
      //   group      — the flat rate IS the unit price (not divided by pax count)
      //                A group booking is 1 unit regardless of how many guests attend.
      const unitPriceCents = isGroupPriced
        ? subtotalCents
        : (totalQuantityCount > 0 ? Math.round(subtotalCents / totalQuantityCount) : 0);

      const quantity = isGroupPriced
        ? 1               // 1 booking unit (the group/package itself)
        : totalQuantityCount;

      return {
        unitPriceCents,
        adultPax: item.adultPax,
        childPax: item.childPax,
        productId: product.id,
        name: product.title,
        quantity,
        pricingBreakdown: pricing.breakdown,
      };
    }));

    const snapshot = PricingService.createSnapshot(pricedItems);

    // Emit Domain Event
    await eventDispatcher.dispatch(new CartPriced(cartId, snapshot.totalCents, snapshot.vatAmountCents));

    return snapshot;
  }
}
