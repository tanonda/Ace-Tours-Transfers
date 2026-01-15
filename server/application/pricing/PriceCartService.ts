
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

  async priceCart(cartId: string, items: { productId: string; adultPax: number; childPax: number }[]): Promise<PriceSnapshot> {
    const pricedItems = await Promise.all(items.map(async item => {
      const product = await this.storage.getTour(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const rates = await this.priceResolver.getTourRate(item.productId);
      if (!rates) {
        throw new Error(`Rates for product ${item.productId} not found`);
      }

      // For the snapshot, we use the average unit price for now if PricingService expects one,
      // or we can just pass the total cent value.
      const subtotalCents = this.priceResolver.calculateItemTotal(item.adultPax, item.childPax, rates);
      const totalPax = item.adultPax + item.childPax;
      const unitPriceCents = totalPax > 0 ? Math.round(subtotalCents / totalPax) : 0;

      return {
        unitPriceCents,
        adultPax: item.adultPax,
        childPax: item.childPax,
        productId: product.id,
        name: product.title,
        quantity: totalPax
      };
    }));

    const snapshot = PricingService.createSnapshot(pricedItems);

    // Emit Domain Event
    await eventDispatcher.dispatch(new CartPriced(cartId, snapshot.totalCents, snapshot.vatAmountCents));

    return snapshot;
  }
}
