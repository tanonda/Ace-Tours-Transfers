/**
 * Feature Flag Manager for Phase 2E Deployment
 *
 * Controls gradual rollout of PricingEngine to production.
 * Reads from and persists to the feature_flags database table.
 */

import { db } from './db.js';
import { featureFlags } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

export interface FeatureFlag {
  id: string;
  slug: string;
  enabled: boolean;
  rolloutPercentage: number;
  displayName: string;
  description: string | null;
  updatedAt: Date;
  updatedBy: string;
}

enum FlagName {
  USE_PRICING_ENGINE = 'USE_PRICING_ENGINE',
}

let flagCache: Map<string, FeatureFlag> = new Map();
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000;

async function loadFlags(): Promise<void> {
  const rows = await db.select().from(featureFlags);
  flagCache.clear();
  for (const row of rows) {
    flagCache.set(row.slug, {
      id: row.id,
      slug: row.slug,
      enabled: row.enabled,
      rolloutPercentage: row.rolloutPercentage,
      displayName: row.displayName,
      description: row.description,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    });
  }
  cacheLoadedAt = Date.now();
}

async function ensureCache(): Promise<void> {
  if (Date.now() - cacheLoadedAt > CACHE_TTL_MS) {
    await loadFlags();
  }
}

function getFeatureFlagSync(name: FlagName): FeatureFlag | null {
  return flagCache.get(name) ?? null;
}

/**
 * Check if a feature is enabled for a user.
 * Uses rolloutPercentage for gradual rollout.
 */
export function isFeatureEnabled(
  flagName: FlagName,
  userId?: string,
  appliedSessionId?: string
): boolean {
  if (process.env.NODE_ENV === 'development') {
    return process.env.FORCE_PRICING_ENGINE === 'true';
  }

  const flag = getFeatureFlagSync(flagName);
  if (!flag || !flag.enabled) return false;
  if (flag.rolloutPercentage === 100) return true;
  if (flag.rolloutPercentage === 0) return false;

  const identifier = userId || appliedSessionId || 'anonymous';
  const hash = hashIdentifier(identifier);
  const percentage = (hash % 100) + 1;
  return percentage <= flag.rolloutPercentage;
}

function hashIdentifier(identifier: string): number {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Update feature flag rollout percentage (persisted to DB).
 */
export async function updateRolloutPercentage(
  flagName: FlagName,
  percentage: number,
  reason: string
): Promise<void> {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Rollout percentage must be 0-100');
  }

  const flag = getFeatureFlagSync(flagName);
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
`);

  await db.update(featureFlags)
    .set({
      rolloutPercentage: percentage,
      updatedAt: new Date(),
      updatedBy: 'system',
    })
    .where(eq(featureFlags.slug, flagName));

  flag.rolloutPercentage = percentage;
  flag.updatedAt = new Date();
}

/**
 * Disable feature flag (rollback), persisted to DB.
 */
export async function disableFeatureFlag(
  flagName: FlagName,
  reason: string
): Promise<void> {
  const flag = getFeatureFlagSync(flagName);
  if (!flag) {
    throw new Error(`Feature flag not found: ${flagName}`);
  }

  console.log(`
╔═══════════════════════════════════════════════════════╗
║            FEATURE FLAG DISABLED                     ║
║                 ROLLBACK IN PROGRESS                 ║
╚═══════════════════════════════════════════════════════╝

Flag:       ${flagName}
Reason:     ${reason}
Time:       ${new Date().toISOString()}
`);

  await db.update(featureFlags)
    .set({
      enabled: false,
      rolloutPercentage: 0,
      updatedAt: new Date(),
      updatedBy: 'system',
    })
    .where(eq(featureFlags.slug, flagName));

  flag.enabled = false;
  flag.rolloutPercentage = 0;
  flag.updatedAt = new Date();
}

/**
 * Log feature flag decision for audit trail.
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

Decision:            ${decision === 'proceed' ? 'OK TO PROCEED' : decision === 'investigate' ? 'INVESTIGATE FURTHER' : 'ROLLBACK TRIGGERED'}
`);
}

/**
 * Get deployment status for monitoring.
 */
export function getDeploymentStatus(): {
  flag: FlagName;
  enabled: boolean;
  rolloutPercentage: number;
  wave: string;
  expectedUsers: number;
  status: string;
} {
  const flag = getFeatureFlagSync(FlagName.USE_PRICING_ENGINE);

  const enabled = flag?.enabled ?? false;
  const rolloutPercentage = flag?.rolloutPercentage ?? 0;

  let wave = 'Not Started';
  if (!enabled) {
    wave = 'Pre-Deployment';
  } else if (rolloutPercentage <= 10) {
    wave = 'Wave 1 (10% traffic)';
  } else if (rolloutPercentage <= 50) {
    wave = 'Wave 2 (50% traffic)';
  } else if (rolloutPercentage === 100) {
    wave = 'Wave 3 (100% traffic)';
  }

  return {
    flag: FlagName.USE_PRICING_ENGINE,
    enabled,
    rolloutPercentage,
    wave,
    expectedUsers: Math.round((rolloutPercentage / 100) * 1000),
    status: enabled ? 'ROLLING OUT' : 'PAUSED',
  };
}

/**
 * Initialize flag cache at startup. Call once from server init.
 */
export async function initFeatureFlags(): Promise<void> {
  await loadFlags();
  console.log(`[FEATURE FLAGS] Loaded ${flagCache.size} flags from database`);
}

export { isFeatureEnabled as shouldUsePricingEngine };
export { FlagName };
