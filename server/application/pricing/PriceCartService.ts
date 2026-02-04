
import { PricingService, PriceSnapshot } from "../../domain/pricing/PricingService.js";
import { IStorage } from "../../storage.js";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { CartPriced } from "../../domain/events.js";
import { PriceResolver } from "../../domain/pricing/PriceResolver.js";

export class PriceCartService {
  private priceResolver: PriceResolver;

  constructor(private storage: IStorage) {
    this.priceResolver = new PriceResolver(storage);
  }

  async priceCart(cartId: string, items: { productId: string; adultPax: number; childPax: number; quantity?: number }[]): Promise<PriceSnapshot> {
    const pricedItems = await Promise.all(items.map(async item => {
      const product = await this.storage.getTour(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const rates = await this.priceResolver.getTourRate(item.productId);
      if (!rates) {
        throw new Error(`Rates for product ${item.productId} not found`);
      }

      // For the snapshot, we use the average unit price for now
      let subtotalCents = this.priceResolver.calculateItemTotal(item.adultPax, item.childPax, rates);
      
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
        quantity: totalQuantityCount
      };
    }));

    const snapshot = PricingService.createSnapshot(pricedItems);

    // Emit Domain Event
    await eventDispatcher.dispatch(new CartPriced(cartId, snapshot.totalCents, snapshot.vatAmountCents));

    return snapshot;
  }
}
