"use client";
import React from 'react';
import { formatCurrency } from './price-formatting';
import type { PricingBreakdownProps } from './types';
import './PricingBreakdown.css';

export const PricingBreakdown: React.FC<PricingBreakdownProps> = ({
  pricing,
  currency = '€',
}) => {
  if (!pricing) {
    return null;
  }

  // Branch 1: Single-item (from AvailabilityResult)
  if ('subtotalCents' in pricing && pricing.breakdown) {
    const { subtotalCents, breakdown, appliedDiscounts } = pricing;
    return (
      <div className="pricing-breakdown single-item">
        <div className="breakdown-header">
          <h3>Pricing Breakdown</h3>
        </div>
        <div className="pricing-items">
          {breakdown?.adultSubtotal > 0 && (
            <div className="pricing-item">
              <span className="item-label">Adults</span>
              <span className="item-price">{formatCurrency(breakdown.adultSubtotal, currency)}</span>
            </div>
          )}
          {breakdown?.childSubtotal > 0 && (
            <div className="pricing-item">
              <span className="item-label">Children</span>
              <span className="item-price">{formatCurrency(breakdown.childSubtotal, currency)}</span>
            </div>
          )}
          {breakdown?.addonsTotal > 0 && (
            <div className="pricing-item">
              <span className="item-label">Add-ons</span>
              <span className="item-price">{formatCurrency(breakdown.addonsTotal, currency)}</span>
            </div>
          )}
        </div>
        {appliedDiscounts && appliedDiscounts.length > 0 && (
          <div className="rules-section">
            <h4>Applied Adjustments</h4>
            <div className="rules-list">
              {appliedDiscounts.map((rule, idx) => (
                <div key={idx} className="rule-explanation">
                  <span className="rule-bullet">✅</span>
                  <span className="rule-text">{rule}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="pricing-divider" />
        <div className="pricing-total">
          <span>TOTAL</span>
          <span>{formatCurrency(subtotalCents || 0, currency)}</span>
        </div>
      </div>
    );
  }

  // Branch 2: Cart-level (from api.PricingSnapshot)
  if ('totalCents' in pricing && pricing.items) {
    const { totalCents, items } = pricing as any;
    const adultSub = items.reduce((sum: number, i: any) => sum + (i.breakdown?.adultSubtotalCents || 0), 0);
    const childSub = items.reduce((sum: number, i: any) => sum + (i.breakdown?.childSubtotalCents || 0), 0);
    const addonsSub = items.reduce((sum: number, i: any) => sum + (i.breakdown?.addonsSubtotalCents || 0), 0);
    const discounts = items.reduce((sum: number, i: any) => sum + (i.breakdown?.discountsCents || 0), 0);
    const allRules = Array.from(new Set(items.flatMap((i: any) => i.breakdown?.appliedRules || [])));

    return (
      <div className="pricing-breakdown cart-level">
        <div className="breakdown-header">
          <h3>Order Summary</h3>
        </div>
        <div className="pricing-items">
          {adultSub > 0 && (
            <div className="pricing-item">
              <span className="item-label">Adults Total</span>
              <span className="item-price">{formatCurrency(adultSub, currency)}</span>
            </div>
          )}
          {childSub > 0 && (
            <div className="pricing-item">
              <span className="item-label">Children Total</span>
              <span className="item-price">{formatCurrency(childSub, currency)}</span>
            </div>
          )}
          {addonsSub > 0 && (
            <div className="pricing-item">
              <span className="item-label">Add-ons Total</span>
              <span className="item-price">{formatCurrency(addonsSub, currency)}</span>
            </div>
          )}
          {discounts !== 0 && (
            <div className="pricing-item discount">
              <span className="item-label">Savings</span>
              <span className="item-price">-{formatCurrency(Math.abs(discounts), currency)}</span>
            </div>
          )}
        </div>
        {allRules.length > 0 && (
          <div className="rules-section">
            <h4>Combined Adjustments</h4>
            <div className="rules-list">
              {allRules.map((rule: any, idx) => (
                <div key={idx} className="rule-explanation">
                  <span className="rule-bullet">✨</span>
                  <span className="rule-text">{rule}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="pricing-divider" />
        <div className="pricing-total">
          <span>GRAND TOTAL</span>
          <span>{formatCurrency(totalCents, currency)}</span>
        </div>
      </div>
    );
  }

  return null;
};

export default PricingBreakdown;
