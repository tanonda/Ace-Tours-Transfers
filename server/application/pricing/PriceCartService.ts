
import { PricingService, PriceSnapshot } from "../../domain/pricing/PricingService";
import { IStorage } from "../../storage";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher";
import { CartPriced } from "../../domain/events";

export class PriceCartService {
  constructor(private storage: IStorage) {}

  async priceCart(cartId: string, items: { productId: string; quantity: number }[]): Promise<PriceSnapshot> {
    const pricedItems = await Promise.all(items.map(async item => {
      const product = await this.storage.getTour(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      return {
        productId: product.id,
        name: product.title,
        price: parseFloat(product.price.replace(/[^0-9.]/g, '')),
        quantity: item.quantity
      };
    }));

    const snapshot = PricingService.createSnapshot(pricedItems);

    // Emit Domain Event
    await eventDispatcher.dispatch(new CartPriced(cartId, snapshot.total, snapshot.vatAmount));

    return snapshot;
  }
}
