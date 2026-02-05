
export interface PricedItem {
  productId: string;
  name: string;
  quantity: number;
  adultPax: number;
  childPax: number;
  unitPriceCents: number;
  subtotalCents: number;
}

import { config } from "../../config.js";

export interface PriceSnapshot {
  items: PricedItem[];
  baseAmountCents: number;
  vatAmountCents: number;
  totalCents: number;
  currency: string;
}

export class PricingService {
  private static readonly VAT_RATE = config.ddd.vatRateOverride || 0.15;

  public static calculatePrice(unitPrice: number, quantity: number): number {
    return unitPrice * quantity;
  }

  public static calculateVAT(amountCents: number): number {
    return Math.round(amountCents * this.VAT_RATE);
  }

  public static createSnapshot(items: { 
    unitPriceCents: number; 
    adultPax: number; 
    childPax: number; 
    productId: string; 
    name: string;
    quantity?: number; // fallback for legacy
  }[]): PriceSnapshot {
    const pricedItems: PricedItem[] = items.map(item => {
      const quantity = item.quantity || (item.adultPax + item.childPax);
      // For now, if unitPriceCents is provided as a single value, we use it for all pax.
      // But the PriceResolver will eventually provide specific adult/child rates.
      const subtotalCents = item.unitPriceCents * quantity;

      return {
        productId: item.productId,
        name: item.name,
        quantity,
        adultPax: item.adultPax,
        childPax: item.childPax,
        unitPriceCents: item.unitPriceCents,
        subtotalCents
      };
    });

    const baseAmountCents = pricedItems.reduce((sum, item) => sum + item.subtotalCents, 0);
    const vatAmountCents = this.calculateVAT(baseAmountCents);
    const totalCents = baseAmountCents + vatAmountCents;

    return {
      items: pricedItems,
      baseAmountCents,
      vatAmountCents,
      totalCents,
      currency: 'VUV'
    };
  }

  public static formatTotal(amountCents: number): string {
    return `VUV ${(amountCents / 100).toLocaleString()}`;
  }
}
