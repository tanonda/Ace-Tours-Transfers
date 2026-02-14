import React, { useState } from 'react';
import { RuleExplanation } from './RuleExplanation';
import { formatCurrency } from './price-formatting';
import type { PricingBreakdownProps, PricingBreakdownItem, AppliedRule } from './types';
import './PricingBreakdown.css';

export const PricingBreakdown: React.FC<PricingBreakdownProps> = ({
  pricing,
  showDetailedRules = true,
  currency = '€',
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!pricing) {
    return null;
  }

  const {
    itemTotal,
    discountTotal,
    surchargeTotal,
    vatTotal,
    finalTotal,
    breakdown,
    appliedRules,
  } = pricing;

  const totalSavings = Math.abs(discountTotal);
  const hasRules = appliedRules && appliedRules.length > 0;
  const hasDiscounts = discountTotal < 0;

  return (
    <div className="pricing-breakdown">
      <div className="breakdown-header">
        <h3>Pricing Breakdown</h3>
        {hasRules && (
          <button
            className="expand-button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            {expanded ? '▼' : '▶'} Details
          </button>
        )}
      </div>

      {/* Main pricing line items */}
      <div className="pricing-items">
        {breakdown?.map((item: PricingBreakdownItem, idx: number) => (
          <div key={idx} className="pricing-item">
            <span className="item-label">{item.label}</span>
            <span className="item-price">
              {formatCurrency(item.amount, currency)}
            </span>
          </div>
        ))}
      </div>

      {/* Subtotal */}
      <div className="pricing-divider" />

      <div className="pricing-subtotal">
        <span>Subtotal</span>
        <span>{formatCurrency(itemTotal, currency)}</span>
      </div>

      {/* Discounts (if any) */}
      {hasDiscounts && (
        <div className="pricing-item discount">
          <span className="item-label">✅ Group Discount</span>
          <span className="item-price discount">
            -{formatCurrency(totalSavings, currency)}
          </span>
        </div>
      )}

      {/* Surcharges (if any) */}
      {surchargeTotal > 0 && (
        <div className="pricing-item surcharge">
          <span className="item-label">📅 Seasonal Surcharge</span>
          <span className="item-price surcharge">
            +{formatCurrency(surchargeTotal, currency)}
          </span>
        </div>
      )}

      {/* Subtotal after discounts/surcharges */}
      {(hasDiscounts || surchargeTotal > 0) && (
        <>
          <div className="pricing-divider" />
          <div className="pricing-subtotal">
            <span>Subtotal</span>
            <span>
              {formatCurrency(
                itemTotal + discountTotal + surchargeTotal,
                currency
              )}
            </span>
          </div>
        </>
      )}

      {/* VAT */}
      <div className="pricing-item vat">
        <span className="item-label">🌍 VAT (15%)</span>
        <span className="item-price">{formatCurrency(vatTotal, currency)}</span>
      </div>

      {/* Total */}
      <div className="pricing-divider" />
      <div className="pricing-total">
        <span>TOTAL</span>
        <span>{formatCurrency(finalTotal, currency)}</span>
      </div>

      {/* Savings highlight */}
      {hasDiscounts && (
        <div className="savings-highlight">
          ✨ You save: {formatCurrency(totalSavings, currency)}
        </div>
      )}

      {/* Detailed rules (expandable) */}
      {expanded && hasRules && showDetailedRules && (
        <div className="rules-section">
          <h4>Applied Rules</h4>
          <div className="rules-list">
            {appliedRules?.map((rule: AppliedRule, idx: number) => (
              <RuleExplanation key={idx} rule={rule} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingBreakdown;
