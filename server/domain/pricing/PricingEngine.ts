/**
 * PricingEngine — Unified, single source of truth for ALL pricing calculations.
 *
 * CHANGES vs. original:
 *  - Added `pricingType` support: 'per_person' | 'group'
 *  - Group pricing: flat groupPriceCents regardless of pax count
 *  - Discount/surcharge rules come from Admin → Pricing (`pricing_rules` setting);
 *    the seasonal surcharge applies to group prices, the group discount does not
 *  - Currency conversion helpers added (view-layer only, DB always VUV)
 */

import { IStorage } from '../../storage.js';
import { Product } from '../../../shared/schema.js';
import {
  DEFAULT_PRICING_RULES,
  PRICING_RULES_SETTING_KEY,
  groupDiscountApplies,
  groupDiscountLabel,
  parsePricingRules,
  peakSeasonApplies,
  peakSeasonLabel,
  type PricingRules,
} from '../../../shared/pricing-rules.js';

// ─── Rate and Pricing Type ────────────────────────────────────────────────────

export type PricingType = 'per_person' | 'group';

/** Base rates for a product at a point in time */
export interface TourRate {
  pricingType: PricingType;
  /** Used when pricingType === 'per_person' */
  adultPriceCents: number;
  childPriceCents: number;
  /** Used when pricingType === 'group' — flat rate for entire booking */
  groupPriceCents: number;
  /** Optional display hint: "up to N people included" */
  groupMaxPax?: number | null;
}

/** Detailed breakdown of a price calculation */
export interface PriceBreakdown {
  pricingType: PricingType;
  baseTotalCents: number;           // Pre-rules total
  adultSubtotalCents: number;       // per_person: adultPax × adultRate; group: 0
  childSubtotalCents: number;       // per_person: childPax × childRate; group: 0
  groupSubtotalCents: number;       // group: groupPriceCents; per_person: 0
  addonsSubtotalCents: number;
  discountsCents: number;           // Negative value
  surchargesCents: number;          // Positive value
  finalTotalCents: number;
  appliedRules: string[];
}

export interface PricingResult {
  breakdown: PriceBreakdown;
  appliedDiscounts?: string[];
}

// ─── Currency (view-layer) ────────────────────────────────────────────────────

export interface CurrencyRate {
  code: string;
  symbol: string;
  /** Multiply VUV amount by this rate to get display amount */
  rateFromVUV: number;
  isWholeUnit: boolean;
}

export const CURRENCY_RATES: Record<string, CurrencyRate> = {
  VUV: { code: 'VUV', symbol: 'VT', rateFromVUV: 1, isWholeUnit: true },
  USD: { code: 'USD', symbol: '$', rateFromVUV: 0.0084, isWholeUnit: false },
  AUD: { code: 'AUD', symbol: 'A$', rateFromVUV: 0.013, isWholeUnit: false },
  NZD: { code: 'NZD', symbol: 'NZ$', rateFromVUV: 0.0141, isWholeUnit: false },
  EUR: { code: 'EUR', symbol: '€', rateFromVUV: 0.0078, isWholeUnit: false },
  GBP: { code: 'GBP', symbol: '£', rateFromVUV: 0.0066, isWholeUnit: false },
  JPY: { code: 'JPY', symbol: '¥', rateFromVUV: 1.26, isWholeUnit: true },
  FJD: { code: 'FJD', symbol: 'FJ$', rateFromVUV: 0.019, isWholeUnit: false },
  XPF: { code: 'XPF', symbol: 'CFP', rateFromVUV: 0.93, isWholeUnit: true },
};

export async function fetchLiveExchangeRates() {
  try {
    const req = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/vuv.json');
    if (!req.ok) return;
    const data: any = await req.json();
    if (data?.vuv) {
      for (const [code, def] of Object.entries(CURRENCY_RATES)) {
        const lowerCode = code.toLowerCase();
        if (data.vuv[lowerCode]) {
          def.rateFromVUV = data.vuv[lowerCode];
        }
      }
      console.log("[PRICING] Live exchange rates updated from CDN");
    }
  } catch (err) {
    console.error("[PRICING] Failed to fetch live exchange rates", err);
  }
}

/** Convert VUV integer units to display amount in target currency */
export function convertVUVToDisplay(vuvAmount: number, targetCurrency: string): number {
  const rate = CURRENCY_RATES[targetCurrency.toUpperCase()]?.rateFromVUV ?? 1;
  return vuvAmount * rate;
}

/** Format VUV integer units as a display string in target currency */
export function formatVUVInCurrency(vuvAmount: number, targetCurrency: string): string {
  const def = CURRENCY_RATES[targetCurrency.toUpperCase()] ?? CURRENCY_RATES.VUV;
  const amount = vuvAmount * def.rateFromVUV;
  if (def.isWholeUnit) {
    return `${def.symbol} ${Math.round(amount).toLocaleString('en-US')}`;
  }
  return `${def.symbol}${amount.toFixed(2)}`;
}

// ─── Configuration ────────────────────────────────────────────────────────────

interface PricingEngineOptions {
  /** Fixed rules (tests). Without them the engine reads the admin's `pricing_rules` setting. */
  rules?: PricingRules;
}

// Admin edits reach checkout within this window even without an explicit invalidation.
const RULES_CACHE_MS = 30_000;
let cachedRules: { rules: PricingRules; at: number } | null = null;

/** Called after the admin saves `pricing_rules` so the next quote uses them immediately. */
export function invalidatePricingRulesCache(): void {
  cachedRules = null;
}

// ─── PricingEngine ────────────────────────────────────────────────────────────

export class PricingEngine {
  private storage: IStorage;
  private fixedRules?: PricingRules;

  constructor(storage: IStorage, options: PricingEngineOptions = {}) {
    this.storage = storage;
    this.fixedRules = options.rules;
  }

  /** Discount/surcharge rules as set in Admin → Pricing (defaults if never saved or unreadable). */
  async getPricingRules(): Promise<PricingRules> {
    if (this.fixedRules) return this.fixedRules;
    if (cachedRules && Date.now() - cachedRules.at < RULES_CACHE_MS) return cachedRules.rules;
    try {
      const row = await this.storage.getSiteSetting(PRICING_RULES_SETTING_KEY);
      const rules = parsePricingRules(row?.value);
      cachedRules = { rules, at: Date.now() };
      return rules;
    } catch {
      return DEFAULT_PRICING_RULES; // not cached: retry the database on the next quote
    }
  }

  /**
   * Fetch effective rates for a product, respecting pricing versions.
   */
  async getTourRate(tourId: string, date?: string): Promise<TourRate | null> {
    const tour = await this.storage.getProduct(tourId);
    if (!tour) return null;

    let adultPriceCents = tour.adultPriceCents || 0;
    let childPriceCents = tour.childPriceCents || 0;
    const groupPriceCents = (tour as any).groupPriceCents || 0;
    const pricingType: PricingType = (tour as any).pricingType || 'per_person';

    if (date) {
      const version = await this.storage.getEffectivePricingVersion(tourId, date);
      if (version) {
        adultPriceCents = version.adultPriceCents;
        childPriceCents = version.childPriceCents;
      }
    }

    // Legacy fallback
    if (!adultPriceCents) adultPriceCents = this.parseAmountTextToCents(tour.price);
    if (!childPriceCents) childPriceCents = this.parseAmountTextToCents(tour.childPrice);

    return {
      pricingType,
      adultPriceCents,
      childPriceCents,
      groupPriceCents,
      groupMaxPax: (tour as any).groupMaxPax ?? null,
    };
  }

  /**
   * Full pricing calculation for a booking line item.
   * Supports both per_person and group pricing modes.
   */
  async calculateLineItem(
    adultPax: number,
    childPax: number,
    rates: TourRate,
    date?: string,
    addonIds?: string[]
  ): Promise<PricingResult> {
    const rules = await this.getPricingRules();

    // ── 1. Base subtotal ────────────────────────────────────────────────────
    let adultSubtotalCents = 0;
    let childSubtotalCents = 0;
    let groupSubtotalCents = 0;

    if (rates.pricingType === 'group') {
      groupSubtotalCents = rates.groupPriceCents;
    } else {
      adultSubtotalCents = adultPax * rates.adultPriceCents;
      childSubtotalCents = childPax * rates.childPriceCents;
    }

    const baseTotalCents = adultSubtotalCents + childSubtotalCents + groupSubtotalCents;

    // ── 2. Add-ons ──────────────────────────────────────────────────────────
    let addonsSubtotalCents = 0;
    if (addonIds && addonIds.length > 0) {
      const addons = await Promise.all(addonIds.map((id) => this.storage.getAddon(id)));
      addonsSubtotalCents = addons.reduce((sum, addon) => sum + (addon?.priceCents || 0), 0);
    }

    let totalCents = baseTotalCents + addonsSubtotalCents;
    let discountsCents = 0;
    let surchargesCents = 0;
    const appliedRules: string[] = [];

    // ── 3. Group discount ───────────────────────────────────────────────────
    if (groupDiscountApplies(rules, rates.pricingType, adultPax)) {
      const { percent } = rules.groupDiscount;
      const discountAmount = Math.round(totalCents * (percent / 100));
      totalCents -= discountAmount;
      discountsCents -= discountAmount;
      appliedRules.push(groupDiscountLabel(rules));
    }

    // ── 4. Seasonal surcharge ───────────────────────────────────────────────
    if (peakSeasonApplies(rules, date)) {
      const { percent } = rules.peakSeason;
      const surchargeAmount = Math.round(
        (baseTotalCents + addonsSubtotalCents + discountsCents) * (percent / 100)
      );
      totalCents += surchargeAmount;
      surchargesCents += surchargeAmount;
      appliedRules.push(peakSeasonLabel(rules));
    }

    const breakdown: PriceBreakdown = {
      pricingType: rates.pricingType,
      baseTotalCents,
      adultSubtotalCents,
      childSubtotalCents,
      groupSubtotalCents,
      addonsSubtotalCents,
      discountsCents,
      surchargesCents,
      finalTotalCents: totalCents,
      appliedRules,
    };

    return {
      breakdown,
      appliedDiscounts: appliedRules.length > 0 ? appliedRules : undefined,
    };
  }

  /**
   * Quick synchronous calculation without add-ons (legacy paths). It can't read the
   * database, so it uses the engine's fixed rules or the defaults.
   */
  calculateSimple(
    adultPax: number,
    childPax: number,
    rates: TourRate,
    date?: string,
    rules: PricingRules = this.fixedRules ?? DEFAULT_PRICING_RULES
  ): number {
    let total: number;

    if (rates.pricingType === 'group') {
      total = rates.groupPriceCents;
    } else {
      total = adultPax * rates.adultPriceCents + childPax * rates.childPriceCents;
    }

    if (groupDiscountApplies(rules, rates.pricingType, adultPax)) {
      total = Math.round(total * (1 - rules.groupDiscount.percent / 100));
    }

    if (peakSeasonApplies(rules, date)) {
      total = Math.round(total * (1 + rules.peakSeason.percent / 100));
    }

    return total;
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  private parseAmountTextToCents(text?: string | null): number {
    if (!text) return 0;
    const match = text.match(/[\d,]+(\.\d+)?/);
    if (!match) return 0;
    return Math.round(parseFloat(match[0].replace(/,/g, '')));
  }
}
