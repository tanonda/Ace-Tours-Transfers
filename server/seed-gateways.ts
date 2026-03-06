import "dotenv/config";
import { db } from "./db.js";
import { paymentGateways } from "../shared/schema.js";
import { eq } from "drizzle-orm";

/**
 * Standalone script to seed payment gateways on any database.
 * Run with: DATABASE_URL=<prod_url> npx tsx server/seed-gateways.ts
 *
 * Also exported as `seedGateways()` for use in server startup auto-seed.
 */

const GATEWAY_DATA = [
  // ── 1. ONLINE PAYMENT GATEWAYS (10) ──────────────────────────────────
  {
    slug: "anz-egate",
    displayName: "ANZ eGate",
    description: "Vanuatu bank gateway via ANZ Pacific (Mastercard Gateway).",
    active: false,
    priority: 1,
    supportedCurrencies: ["VUV", "AUD"],
    credentials: {},
    config: {}
  },
  {
    slug: "anz",
    displayName: "ANZ Bank",
    description: "ANZ Bank direct merchant integration.",
    active: false,
    priority: 2,
    supportedCurrencies: ["VUV", "AUD"],
    credentials: {},
    config: {}
  },
  {
    slug: "bsp-bank",
    displayName: "BSP Bank",
    description: "Bank of South Pacific online payment gateway.",
    active: false,
    priority: 3,
    supportedCurrencies: ["VUV"],
    credentials: {},
    config: {}
  },
  {
    slug: "bsp",
    displayName: "BSP eGate",
    description: "BSP eGate payment processing services.",
    active: false,
    priority: 4,
    supportedCurrencies: ["VUV"],
    credentials: {},
    config: {}
  },
  {
    slug: "bred-bank",
    displayName: "Bred Bank",
    description: "Bred Bank Vanuatu payment processing.",
    active: false,
    priority: 5,
    supportedCurrencies: ["VUV"],
    credentials: {},
    config: {}
  },
  {
    slug: "bred",
    displayName: "Bred eGate",
    description: "Bred Bank eGate merchant services.",
    active: false,
    priority: 6,
    supportedCurrencies: ["VUV"],
    credentials: {},
    config: {}
  },
  {
    slug: "mastercard-gateway",
    displayName: "Mastercard Gateway",
    description: "Generic Mastercard Payment Gateway Service (MPGS).",
    active: false,
    priority: 7,
    supportedCurrencies: ["VUV", "AUD", "USD"],
    credentials: {},
    config: {}
  },
  {
    slug: "generic-local-bank",
    displayName: "Local Bank (Other)",
    description: "Generic integration for other local Vanuatu banks.",
    active: false,
    priority: 8,
    supportedCurrencies: ["VUV"],
    credentials: {},
    config: {}
  },
  {
    slug: "stripe",
    displayName: "Stripe",
    description: "International card payments. NOTE: Keep inactive for Vanuatu merchants unless using an offshore entity.",
    active: false,
    priority: 9,
    supportedCurrencies: ["USD", "AUD", "NZD"],
    credentials: {},
    config: { environment: "test" }
  },
  {
    slug: "paypal",
    displayName: "PayPal",
    description: "International PayPal payments for tourists.",
    active: false,
    priority: 10,
    supportedCurrencies: ["USD", "AUD", "NZD"],
    credentials: {},
    config: {}
  },

  // ── 2. DIGITAL E-WALLETS & MOBILE MONEY (6) ──────────────────────────
  {
    slug: "wantok-money",
    displayName: "WanTok Money",
    description: "Local mobile money and e-wallet payments.",
    active: false,
    priority: 11,
    supportedCurrencies: ["VUV"],
    credentials: {},
    config: {}
  },
  {
    slug: "digicel-mobile-money",
    displayName: "Digicel Mobile Money",
    description: "Digicel Vanuatu mobile money app and USSD payments.",
    active: false,
    priority: 12,
    supportedCurrencies: ["VUV"],
    credentials: {},
    config: {}
  },
  {
    slug: "kwikpay",
    displayName: "KwikPay",
    description: "KwikPay e-wallet for fast QR-code payments.",
    active: false,
    priority: 13,
    supportedCurrencies: ["VUV"],
    credentials: {},
    config: {}
  },
  {
    slug: "e-wallet",
    displayName: "Generic E-Wallet",
    description: "Standard integration for local digital wallets.",
    active: false,
    priority: 14,
    supportedCurrencies: ["VUV"],
    credentials: {},
    config: {}
  },
  {
    slug: "google-pay",
    displayName: "Google Pay",
    description: "Google Pay digital wallet via supported processors.",
    active: false,
    priority: 15,
    supportedCurrencies: ["USD", "AUD"],
    credentials: {},
    config: {}
  },
  {
    slug: "apple-pay",
    displayName: "Apple Pay",
    description: "Apple Pay digital wallet via supported processors.",
    active: false,
    priority: 16,
    supportedCurrencies: ["USD", "AUD"],
    credentials: {},
    config: {}
  },

  // ── 3. OFFLINE & MANUAL METHODS (5) ──────────────────────────────────
  {
    slug: "manual_transfer",
    displayName: "Bank Transfer (Direct)",
    description: "Direct transfer to Ace Tours bank account. Admin confirms manually.",
    active: true,
    isDefault: true,
    priority: 17,
    supportedCurrencies: ["VUV", "AUD", "USD", "NZD"],
    credentials: {},
    config: {}
  },
  {
    slug: "cash",
    displayName: "Cash on Delivery",
    description: "Pay in cash at the start of your tour or vehicle pickup.",
    active: true,
    isDefault: false,
    priority: 18,
    supportedCurrencies: ["VUV", "AUD", "USD", "NZD"],
    credentials: {},
    config: {}
  },
];

/**
 * Seed payment gateways — safe to call at startup or via CLI.
 * Uses upsert-by-slug (insert if new, update display fields if existing).
 */
export async function seedGateways(): Promise<void> {
  console.log("Seeding payment gateways...");

  let created = 0;
  let skipped = 0;

  for (const gateway of GATEWAY_DATA) {
    const existing = await db.select().from(paymentGateways).where(eq(paymentGateways.slug, gateway.slug)).limit(1);
    if (existing.length === 0) {
      await db.insert(paymentGateways).values(gateway);
      console.log(`✓ Created: ${gateway.displayName}`);
      created++;
    } else {
      // IMPORTANT: Only update safe metadata fields (displayName, description, priority,
      // supportedCurrencies). Never overwrite admin-managed fields like `active`,
      // `isDefault`, or `credentials` — those are set by admins and must persist
      // across server restarts and redeployments.
      await db.update(paymentGateways)
        .set({
          priority: gateway.priority,
          displayName: gateway.displayName,
          description: gateway.description,
          supportedCurrencies: gateway.supportedCurrencies,
          updatedAt: new Date()
        })
        .where(eq(paymentGateways.slug, gateway.slug));
      console.log(`✓ Metadata refreshed: ${gateway.displayName} (active/credentials preserved)`);
      skipped++;
    }
  }

  console.log(`\nDone! Created: ${created}, Updated: ${skipped}`);
}

// CLI entry point — only runs when executed directly, not when imported
const isMain = process.argv[1] && (
  process.argv[1].endsWith('seed-gateways.ts') ||
  process.argv[1].endsWith('seed-gateways.js')
);

if (isMain) {
  seedGateways().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  }).then(() => process.exit(0));
}
