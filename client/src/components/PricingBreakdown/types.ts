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
  itemTotal: number;
  discountTotal: number;
  surchargeTotal: number;
  vatTotal: number;
  finalTotal: number;
  breakdown: PricingBreakdownItem[];
  appliedRules?: AppliedRule[];
}

export interface PricingBreakdownProps {
  pricing: PricingSnapshot | null;
  showDetailedRules?: boolean;
  currency?: string;
}
