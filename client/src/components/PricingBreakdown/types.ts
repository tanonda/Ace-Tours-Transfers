export interface PricingBreakdownItem {
  label: string;
  amount: number;
}

export interface AppliedRule {
  type: 'group_discount' | 'seasonal_surcharge' | 'vat' | 'addon' | string;
  name: string;
  description: string;
  appliedValue?: string;
}

// Fix #10: Typed structure for individual cart line items — replaces `any` in PricingBreakdown
export interface CartPricingItemBreakdown {
  adultSubtotalCents?: number;
  childSubtotalCents?: number;
  addonsSubtotalCents?: number;
  discountsCents?: number;
  appliedRules?: string[];
}

export interface CartPricingItem {
  id?: string;
  title?: string;
  breakdown?: CartPricingItemBreakdown;
}

export interface PricingSnapshot {
  // Single-item fields (AvailabilityResult)
  subtotalCents?: number;
  breakdown?: {
    adultSubtotal: number;
    childSubtotal: number;
    addonsTotal: number;
  };
  appliedDiscounts?: string[];

  // Cart-level fields (api.PricingSnapshot)
  totalCents?: number;
  items?: CartPricingItem[];
}

export interface PricingBreakdownProps {
  pricing: PricingSnapshot | null | undefined;
  currency?: string;
  expanded?: boolean;
}
