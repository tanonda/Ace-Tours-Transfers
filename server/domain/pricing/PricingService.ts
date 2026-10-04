
export interface PricedItem {
  productId: string;
  name: string;
  quantity: number;
  adultPax: number;
  childPax: number;
  unitPriceCents: number;
  subtotalCents: number;
}

import { CurrencyService } from "./CurrencyService.js";
import { DEFAULT_PRICING_RULES, vatBreakdown, type PricingRules } from "../../../shared/pricing-rules.js";

export interface PriceSnapshot {
  items: PricedItem[];
  baseAmountCents: number;
  vatAmountCents: number;
  totalCents: number;
  currency: string;
  convertedTotal?: number; // Total in requested currency
  currencySymbol?: string;
}

export class PricingService {
  public static calculatePrice(unitPrice: number, quantity: number): number {
    return unitPrice * quantity;
  }

  /** VAT inside (or on top of) an amount, per the admin's VAT setting. */
  public static calculateVAT(amountCents: number, rules: PricingRules = DEFAULT_PRICING_RULES): number {
    return vatBreakdown(rules, amountCents).vatCents;
  }

  public static createSnapshot(items: {
    unitPriceCents: number;
    adultPax: number;
    childPax: number;
    productId: string;
    name: string;
    quantity?: number; // fallback for legacy
  }[], currency: string = 'VUV', rules: PricingRules = DEFAULT_PRICING_RULES): PriceSnapshot {
    const pricedItems: PricedItem[] = items.map(item => {
      const quantity = item.quantity || (item.adultPax + item.childPax);
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

    // Item prices are the advertised prices. With VAT-inclusive pricing (the default,
    // and what the site and brochure say) the customer pays exactly that and the VAT
    // is the share inside it; only VAT-exclusive pricing adds it on top.
    const itemsTotalCents = pricedItems.reduce((sum, item) => sum + item.subtotalCents, 0);
    const { netCents: baseAmountCents, vatCents: vatAmountCents, totalCents } = vatBreakdown(rules, itemsTotalCents);

    const snapshot: PriceSnapshot = {
      items: pricedItems,
      baseAmountCents,
      vatAmountCents,
      totalCents,
      currency: currency.toUpperCase()
    };

    if (currency.toUpperCase() !== 'VUV') {
      snapshot.convertedTotal = CurrencyService.convertFromVatu(totalCents, currency);
      snapshot.currencySymbol = CurrencyService.getSymbol(currency);
    }

    return snapshot;
  }

  public static formatTotal(amountCents: number): string {
    return `VUV ${(amountCents / 100).toLocaleString()}`;
  }
}
