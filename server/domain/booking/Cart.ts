
import { PriceSnapshot } from "../pricing/PricingService.js";

export interface CartLineItem {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  adultPax: number;
  childPax: number;
  date: string;
  slot?: string;
  productType: string;
}

export class Cart {
  private items: CartLineItem[] = [];
  private pricedSnapshot?: PriceSnapshot;

  constructor(public readonly id: string) {}

  public addItem(item: CartLineItem): void {
    // Check if same product/date/slot exists
    const existing = this.items.find(i => 
      i.productId === item.productId && 
      i.date === item.date && 
      i.slot === item.slot
    );

    if (existing) {
      existing.quantity += item.quantity;
      existing.adultPax += item.adultPax;
      existing.childPax += item.childPax;
    } else {
      this.items.push(item);
    }
    
    // Invalidate snapshot when items change
    this.pricedSnapshot = undefined;
  }

  public removeItem(productId: string, date: string, slot?: string): void {
    this.items = this.items.filter(i => 
      !(i.productId === productId && i.date === date && i.slot === slot)
    );
    this.pricedSnapshot = undefined;
  }

  public clear(): void {
    this.items = [];
    this.pricedSnapshot = undefined;
  }

  public getItems(): ReadonlyArray<CartLineItem> {
    return [...this.items];
  }

  public setPricedSnapshot(snapshot: PriceSnapshot): void {
    // Invariant: Cart must contain >= 1 item to be priced
    if (this.items.length === 0) {
      throw new Error("Cannot price an empty cart");
    }
    this.pricedSnapshot = snapshot;
  }

  public getPricedSnapshot(): PriceSnapshot | undefined {
    return this.pricedSnapshot;
  }

  public validate(): void {
    if (this.items.length === 0) {
      throw new Error("Cart must contain at least one line item");
    }
  }
}
