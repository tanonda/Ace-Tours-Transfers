/**
 * PaymentMethodClassifier
 *
 * Single source of truth for distinguishing offline/manual payment methods
 * from online card-processing gateways.
 *
 * WHY THIS EXISTS:
 * Several places in the codebase need to branch on whether a gateway is
 * "manual/offline" (bank transfer, cash) vs "online/card" (ANZ eGate, BSP,
 * BRED, Stripe). Using ad-hoc slug.includes('bank') substring checks is
 * dangerous: 'bsp-bank' and 'bred-bank' contain 'bank' but are online card
 * processors. This classifier uses an explicit allowlist so adding new
 * gateways requires a deliberate decision, not a substring accident.
 *
 * OFFLINE METHODS — no real-time payment processing, admin reconciles manually:
 *   manual, manual_transfer, cash, bank-transfer, bank_transfer
 *
 * ONLINE CARD METHODS — hosted checkout with redirect URL, webhook confirmation:
 *   anz-egate, bsp-bank, bred-bank, wantok-money, generic-local-bank, stripe
 *
 * When a new gateway is added, add its slug to exactly ONE of the sets below.
 */

/** Slugs that represent offline/deferred payment — no gateway redirect, admin confirms. */
const OFFLINE_SLUGS = new Set([
  'manual',
  'manual_transfer',
  'cash',
  'bank-transfer',
  'bank_transfer',
]);

/** Slugs that represent online card-processing gateways — redirect + webhook flow. */
const ONLINE_CARD_SLUGS = new Set([
  'anz-egate',
  'bsp-bank',
  'bred-bank',
  'wantok-money',
  'generic-local-bank',
  'stripe',
  'paypal',
  'google-pay',
  'apple-pay',
  'e-wallet',
]);

export class PaymentMethodClassifier {
  /**
   * Returns true if the gateway slug is an offline/manual payment method.
   * These get status ManualReviewRequired, no checkoutUrl, email sent immediately.
   */
  static isOffline(slug: string): boolean {
    return OFFLINE_SLUGS.has(slug.toLowerCase());
  }

  /**
   * Returns true if the gateway slug is an online card-processing gateway.
   * These get status Processing, return a checkoutUrl redirect, confirm via webhook.
   */
  static isOnlineCard(slug: string): boolean {
    return ONLINE_CARD_SLUGS.has(slug.toLowerCase());
  }

  /**
   * Returns the hold TTL category for a given slug.
   * Offline methods get 72h (customer needs time to do the bank transfer).
   * Online methods get a short TTL (payment is near-instant).
   */
  static holdTtlCategory(slug: string): 'offline' | 'online' {
    return this.isOffline(slug) ? 'offline' : 'online';
  }

  /**
   * Human-readable label for emails and admin UI.
   */
  static displayLabel(slug: string): string {
    if (slug === 'cash') return 'Cash on Delivery';
    if (this.isOffline(slug)) return 'Bank Transfer';
    if (slug === 'stripe') return 'Card (Stripe)';
    if (slug === 'anz-egate') return 'ANZ eGate';
    if (slug === 'bsp-bank') return 'BSP Bank';
    if (slug === 'bred-bank') return 'BRED Bank';
    return slug;
  }
}
