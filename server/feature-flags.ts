/**
 * Feature Flag Manager for Phase 2E Deployment
 * 
 * Controls gradual rollout of PricingEngine to production
 * Enables quick rollback if issues detected
 */

import { db } from './db.js';
import { sql } from 'drizzle-orm';

export interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  rolloutPercentage: number;  // 0-100
  description: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

enum FlagName {
  USE_PRICING_ENGINE = 'USE_PRICING_ENGINE',
}

/**
 * Check if a feature is enabled for a user
 * Uses rolloutPercentage to do gradual rollout
 */
export function isFeatureEnabled(
  flagName: FlagName,
  userId?: string,
  appliedSessionId?: string
): boolean {
  // For testing/development
  if (process.env.NODE_ENV === 'development') {
    return process.env.FORCE_PRICING_ENGINE === 'true';
  }

  // In production, check with rollout percentage
  const flag = getFeatureFlag(flagName);
  if (!flag || !flag.enabled) {
    return false;
  }

  if (flag.rolloutPercentage === 100) {
    return true;
  }

  if (flag.rolloutPercentage === 0) {
    return false;
  }

  // Use user ID for consistent rollout
  const identifier = userId || appliedSessionId || 'anonymous';
  const hash = hashIdentifier(identifier);
  const percentage = (hash % 100) + 1;  // 1-100

  return percentage <= flag.rolloutPercentage;
}

/**
 * Get feature flag configuration
 */
function getFeatureFlag(name: FlagName): FeatureFlag | null {
  // In production, fetch from database
  // For now, return hardcoded config
  return FEATURE_FLAGS[name] || null;
}

/**
 * Hash identifier for consistent rollout
 */
function hashIdentifier(identifier: string): number {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;  // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Current feature flag configuration
 * Update during Wave 1, 2, 3
 */
const FEATURE_FLAGS: Record<FlagName, FeatureFlag> = {
  [FlagName.USE_PRICING_ENGINE]: {
    id: 'ff-pricing-engine-2e',
    name: FlagName.USE_PRICING_ENGINE,
    enabled: false,  // UPDATE TO: true (when ready to deploy)
    rolloutPercentage: 0,  // Wave 1: 10, Wave 2: 50, Wave 3: 100
    description: 'Use unified PricingEngine for all pricing calculations (Phase 2E)',
    createdAt: new Date('2026-02-15T08:00:00Z'),
    updatedAt: new Date('2026-02-15T08:00:00Z'),
    updatedBy: 'system',
  },
};

/**
 * Update feature flag rollout percentage
 * Only update during deployment waves
 */
export async function updateRolloutPercentage(
  flagName: FlagName,
  percentage: number,
  reason: string
): Promise<void> {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Rollout percentage must be 0-100');
  }

  const flag = FEATURE_FLAGS[flagName];
  if (!flag) {
    throw new Error(`Feature flag not found: ${flagName}`);
  }

  console.log(`
╔═══════════════════════════════════════════════════════╗
║         FEATURE FLAG UPDATE - PHASE 2E WAVE          ║
╚═══════════════════════════════════════════════════════╝

Flag:       ${flagName}
Old %:      ${flag.rolloutPercentage}%
New %:      ${percentage}%
Reason:     ${reason}
Time:       ${new Date().toISOString()}

Affects:    ~${Math.round(percentage)}% of bookings
Impact:     Gradual rollout of PricingEngine
`);

  flag.rolloutPercentage = percentage;
  flag.updatedAt = new Date();

  // TODO: In production, also write to database for persistence
  // await db.update(featureFlags)
  //   .set({ rolloutPercentage: percentage })
  //   .where(eq(featureFlags.name, flagName));
}

/**
 * Disable feature flag (rollback)
 */
export async function disableFeatureFlag(
  flagName: FlagName,
  reason: string
): Promise<void> {
  const flag = FEATURE_FLAGS[flagName];
  if (!flag) {
    throw new Error(`Feature flag not found: ${flagName}`);
  }

  console.log(`
╔═══════════════════════════════════════════════════════╗
║            🚨 FEATURE FLAG DISABLED 🚨               ║
║                 ROLLBACK IN PROGRESS                 ║
╚═══════════════════════════════════════════════════════╝

Flag:       ${flagName}
Reason:     ${reason}
Time:       ${new Date().toISOString()}

Status:     Rolling back to old pricing system
Action:     All new bookings using legacy pricing

Next Steps:
  1. Monitor error rate returning to normal
  2. Verify payment processing stable
  3. Schedule postmortem analysis
  4. Fix root cause identified
  5. Prepare for re-deployment
`);

  flag.enabled = false;
  flag.rolloutPercentage = 0;
  flag.updatedAt = new Date();
}

/**
 * Log feature flag decision for audit trail
 */
export function logFlagDecision(
  flagName: FlagName,
  decision: 'proceed' | 'investigate' | 'rollback',
  details: string,
  metrics: {
    errorRate: number;
    avgLatency: number;
    paymentSuccessRate: number;
    sampledBookingsCount: number;
  }
): void {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║          PHASE 2E DEPLOYMENT DECISION LOG           ║
╚═══════════════════════════════════════════════════════╝

Flag:                ${flagName}
Decision:            ${decision.toUpperCase()}
Time:                ${new Date().toISOString()}

Details:
${details}

Metrics Reviewed:
  Error Rate:        ${metrics.errorRate.toFixed(4)}%
  Avg Latency:       ${metrics.avgLatency.toFixed(2)}ms
  Payment Success:   ${metrics.paymentSuccessRate.toFixed(2)}%
  Samples Checked:   ${metrics.sampledBookingsCount}

Decision:            ${decision === 'proceed' ? '✅ OK TO PROCEED' : decision === 'investigate' ? '⚠️  INVESTIGATE FURTHER' : '❌ ROLLBACK TRIGGERED'}
`);
}

/**
 * Get deployment status for monitoring
 */
export function getDeploymentStatus(): {
  flag: FlagName;
  enabled: boolean;
  rolloutPercentage: number;
  wave: string;
  expectedUsers: number;
  status: string;
} {
  const flag = FEATURE_FLAGS[FlagName.USE_PRICING_ENGINE];

  let wave = 'Not Started';
  if (!flag.enabled) {
    wave = 'Pre-Deployment';
  } else if (flag.rolloutPercentage <= 10) {
    wave = 'Wave 1 (10% traffic)';
  } else if (flag.rolloutPercentage <= 50) {
    wave = 'Wave 2 (50% traffic)';
  } else if (flag.rolloutPercentage === 100) {
    wave = 'Wave 3 (100% traffic)';
  }

  return {
    flag: FlagName.USE_PRICING_ENGINE,
    enabled: flag.enabled,
    rolloutPercentage: flag.rolloutPercentage,
    wave,
    expectedUsers: Math.round((flag.rolloutPercentage / 100) * 1000),  // Rough estimate
    status: flag.enabled ? 'ROLLING OUT' : 'PAUSED',
  };
}

// Export flag checking function for use in pricing decisions
export { isFeatureEnabled as shouldUsePricingEngine };

// Export flag name for imports
export { FlagName };
