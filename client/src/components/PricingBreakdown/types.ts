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
  items?: any[];
}

export interface PricingBreakdownProps {
  pricing: PricingSnapshot | null | undefined;
  currency?: string;
  expanded?: boolean;
}
