
export interface PricedItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

import { config } from "../../config";

export interface PriceSnapshot {
  items: PricedItem[];
  baseAmount: number;
  vatAmount: number;
  total: number;
  currency: string;
}

export class PricingService {
  private static readonly VAT_RATE = config.ddd.vatRateOverride || 0.15;

  public static calculatePrice(unitPrice: number, quantity: number): number {
    return unitPrice * quantity;
  }

  public static calculateVAT(amount: number): number {
    return amount * this.VAT_RATE;
  }

  public static createSnapshot(items: { price: number; quantity: number; productId: string; name: string }[]): PriceSnapshot {
    const pricedItems: PricedItem[] = items.map(item => ({
      productId: item.productId,
      name: item.name,
      unitPrice: item.price,
      quantity: item.quantity,
      subtotal: this.calculatePrice(item.price, item.quantity)
    }));

    const baseAmount = pricedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const vatAmount = this.calculateVAT(baseAmount);
    const total = baseAmount + vatAmount;

    return {
      items: pricedItems,
      baseAmount,
      vatAmount,
      total,
      currency: 'VUV'
    };
  }

  public static formatTotal(amount: number): string {
    return `VUV ${amount.toLocaleString()}`;
  }
}
