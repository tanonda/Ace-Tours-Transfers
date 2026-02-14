import React from 'react';
import type { AppliedRule } from './types';

interface RuleExplanationProps {
  rule: AppliedRule;
}

export const RuleExplanation: React.FC<RuleExplanationProps> = ({ rule }) => {
  const getRuleIcon = (type: string) => {
    switch (type) {
      case 'group_discount':
        return '✅';
      case 'seasonal_surcharge':
        return '📅';
      case 'vat':
        return '🌍';
      case 'addon':
        return '🎁';
      default:
        return '•';
    }
  };

  const getRuleColor = (type: string) => {
    switch (type) {
      case 'group_discount':
        return 'discount';
      case 'seasonal_surcharge':
        return 'surcharge';
      case 'vat':
        return 'vat';
      default:
        return 'neutral';
    }
  };

  return (
    <div className={`rule-explanation ${getRuleColor(rule.type)}`}>
      <div className="rule-header">
        <span className="rule-icon">{getRuleIcon(rule.type)}</span>
        <span className="rule-name">{rule.name}</span>
      </div>
      <p className="rule-description">{rule.description}</p>
      {rule.appliedValue && (
        <div className="rule-value">
          <span className="value-label">Applied:</span>
          <span className="value-amount">{rule.appliedValue}</span>
        </div>
      )}
    </div>
  );
};
