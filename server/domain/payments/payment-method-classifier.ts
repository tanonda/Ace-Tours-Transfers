/**
 * PaymentMethodClassifier
 *
 * Single source of truth for:
 * 1. Distinguishing offline/manual vs online card-processing gateways
 * 2. Mapping gateway slugs to guest-facing payment METHOD CATEGORIES
 * 3. Grouping multiple gateways into a single guest-facing option
 *
 * GUEST-FACING METHOD CATEGORIES:
 *   card          — Pay with Card (ANZ eGate, BSP, BRED, Stripe)
 *   paypal        — PayPal
 *   mobile-money  — Mobile Money (WanTok, Digicel MyCash, KwikPay)
 *   digital-wallet — Digital Wallet (Google Pay, Apple Pay)
 *   bank-transfer — Bank Transfer (manual)
 *   cash          — Cash on Delivery
 *
 * The guest sees METHOD categories, never raw gateway slugs.
 * For categories with a single gateway (card, paypal, bank-transfer, cash),
 * the system auto-selects the highest-priority active gateway.
 * For categories with multiple providers (mobile-money, digital-wallet),
 * the guest picks a sub-option (their specific provider/device wallet).
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type PaymentMethodCategory =
  | 'card'
  | 'paypal'
  | 'mobile-money'
  | 'digital-wallet'
  | 'bank-transfer'
  | 'cash';

export interface PaymentMethodOption {
  method: PaymentMethodCategory;
  label: string;
  description: string;
  icon: string;
  /** The auto-selected gateway slug (for single-gateway categories) */
  gatewaySlug?: string;
  gatewayId?: string;
  /** Sub-options the guest picks from (for multi-provider categories) */
  subOptions?: Array<{
    slug: string;
    label: string;
    id?: string;
  }>;
}

// ── Gateway → Category mapping ─────────────────────────────────────────────

/** Slugs that represent offline/deferred payment — no gateway redirect, admin confirms. */
const OFFLINE_SLUGS = new Set([
  'manual',
  'manual_transfer',
  'cash',
]);

/** Slugs that represent online card-processing gateways — redirect + webhook flow. */
const ONLINE_CARD_SLUGS = new Set([
  'anz-egate',
  'bsp-bank',
  'bred-bank',
  'wantok-money',
  'digicel-mobile-money',
  'kwikpay',
  'generic-local-bank',
  'stripe',
  'paypal',
  'google-pay',
  'apple-pay',
  'e-wallet',
]);

/** Maps every known gateway slug to a guest-facing method category. */
const SLUG_TO_CATEGORY: Record<string, PaymentMethodCategory> = {
  // Card processors — consolidated into one "Pay with Card" option
  'anz-egate': 'card',
  'bsp-bank': 'card',
  'bred-bank': 'card',
  'stripe': 'card',

  // PayPal
  'paypal': 'paypal',

  // Mobile money — guest picks their provider
  'wantok-money': 'mobile-money',
  'digicel-mobile-money': 'mobile-money',
  'kwikpay': 'mobile-money',

  // Digital wallets — guest picks their wallet type
  'google-pay': 'digital-wallet',
  'apple-pay': 'digital-wallet',

  // Offline methods
  'manual': 'bank-transfer',
  'manual_transfer': 'bank-transfer',
  'cash': 'cash',

  // Legacy / catch-all
  'generic-local-bank': 'card',
  'e-wallet': 'mobile-money',
};

/** Guest-facing labels for each category. */
const CATEGORY_LABELS: Record<PaymentMethodCategory, { label: string; description: string; icon: string }> = {
  'card': {
    label: 'Pay with Card',
    description: 'Visa, Mastercard, and other cards',
    icon: 'credit-card',
  },
  'paypal': {
    label: 'PayPal',
    description: 'Pay with your PayPal account',
    icon: 'paypal',
  },
  'mobile-money': {
    label: 'Mobile Money',
    description: 'Pay via mobile wallet',
    icon: 'smartphone',
  },
  'digital-wallet': {
    label: 'Digital Wallet',
    description: 'Apple Pay or Google Pay',
    icon: 'wallet',
  },
  'bank-transfer': {
    label: 'Bank Transfer',
    description: 'Transfer directly to our bank account',
    icon: 'building',
  },
  'cash': {
    label: 'Cash',
    description: 'Pay on arrival',
    icon: 'banknote',
  },
};

/** Display order for categories. */
const CATEGORY_ORDER: PaymentMethodCategory[] = [
  'card',
  'paypal',
  'digital-wallet',
  'mobile-money',
  'bank-transfer',
  'cash',
];

/** Categories that show sub-options so the guest picks their provider. */
const MULTI_PROVIDER_CATEGORIES = new Set<PaymentMethodCategory>([
  'mobile-money',
  'digital-wallet',
]);

// ── Classifier ─────────────────────────────────────────────────────────────

export class PaymentMethodClassifier {
  /**
   * Returns true if the gateway slug is an offline/manual payment method.
   */
  static isOffline(slug: string): boolean {
    return OFFLINE_SLUGS.has(slug.toLowerCase());
  }

  /**
   * Returns true if the gateway slug is an online card-processing gateway.
   */
  static isOnlineCard(slug: string): boolean {
    return ONLINE_CARD_SLUGS.has(slug.toLowerCase());
  }

  /**
   * Returns the hold TTL category for a given slug.
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
    if (slug === 'paypal') return 'PayPal';
    if (slug === 'wantok-money') return 'WanTok Money';
    if (slug === 'digicel-mobile-money') return 'Digicel MyCash';
    if (slug === 'kwikpay') return 'KwikPay';
    if (slug === 'google-pay') return 'Google Pay';
    if (slug === 'apple-pay') return 'Apple Pay';
    return slug;
  }

  /**
   * Returns the guest-facing method category for a gateway slug.
   */
  static getCategory(slug: string): PaymentMethodCategory | undefined {
    return SLUG_TO_CATEGORY[slug.toLowerCase()];
  }

  /**
   * Groups an array of active gateway records into guest-facing payment methods.
   *
   * For single-gateway categories (card, paypal, bank-transfer, cash),
   * the highest-priority (or default) gateway is auto-selected.
   *
   * For multi-provider categories (mobile-money, digital-wallet),
   * all active providers are listed as sub-options.
   */
  static groupByMethod(gateways: Array<{
    id: string;
    slug: string;
    displayName: string;
    active?: boolean;
    isDefault?: boolean;
    priority?: number | null;
  }>): PaymentMethodOption[] {
    // Group gateways by category
    const grouped = new Map<PaymentMethodCategory, typeof gateways>();

    for (const gw of gateways) {
      const category = this.getCategory(gw.slug);
      if (!category) continue; // Unknown slug, skip

      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(gw);
    }

    // Build sorted output
    const result: PaymentMethodOption[] = [];

    for (const category of CATEGORY_ORDER) {
      const categoryGateways = grouped.get(category);
      if (!categoryGateways || categoryGateways.length === 0) continue;

      const meta = CATEGORY_LABELS[category];

      if (MULTI_PROVIDER_CATEGORIES.has(category)) {
        // Multi-provider: list all as sub-options
        result.push({
          method: category,
          label: meta.label,
          description: meta.description,
          icon: meta.icon,
          subOptions: categoryGateways
            .sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50))
            .map(gw => ({
              slug: gw.slug,
              label: this.displayLabel(gw.slug),
              id: gw.id,
            })),
        });
      } else {
        // Single-gateway: pick best (default first, then highest priority)
        const sorted = [...categoryGateways].sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return (a.priority ?? 50) - (b.priority ?? 50);
        });
        const best = sorted[0];

        result.push({
          method: category,
          label: meta.label,
          description: meta.description,
          icon: meta.icon,
          gatewaySlug: best.slug,
          gatewayId: best.id,
        });
      }
    }

    return result;
  }
}
