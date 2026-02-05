import "dotenv/config";
import { db } from "./db.js";
import { paymentGateways } from "../shared/schema.js";
import { eq } from "drizzle-orm";

/**
 * Standalone script to seed payment gateways on any database.
 * Run with: DATABASE_URL=<prod_url> npx tsx server/seed-gateways.ts
 */

async function main() {
  console.log("Seeding payment gateways...");

  const gatewayData = [
    {
      slug: "stripe",
      displayName: "Stripe",
      description: "International card payments via Stripe. Supports Visa, Mastercard, AMEX.",
      active: true,
      isDefault: true,
      priority: 1,
      supportedCurrencies: ["USD", "AUD", "NZD", "VUV"],
      credentials: {},
      config: { environment: "test" }
    },
    {
      slug: "anz-egate",
      displayName: "ANZ eGate",
      description: "Local Vanuatu bank gateway via ANZ Pacific.",
      active: false,
      isDefault: false,
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
      isDefault: false,
      priority: 3,
      supportedCurrencies: ["VUV"],
      credentials: {},
      config: {}
    },
    {
      slug: "bred-bank",
      displayName: "Bred Bank",
      description: "Bred Bank Vanuatu payment processing.",
      active: false,
      isDefault: false,
      priority: 4,
      supportedCurrencies: ["VUV"],
      credentials: {},
      config: {}
    },
    {
      slug: "wantok-money",
      displayName: "WanTok Money",
      description: "Local mobile money and e-wallet payments.",
      active: false,
      isDefault: false,
      priority: 5,
      supportedCurrencies: ["VUV"],
      credentials: {},
      config: {}
    },
    {
      slug: "paypal",
      displayName: "PayPal",
      description: "International PayPal payments for tourists.",
      active: false,
      isDefault: false,
      priority: 6,
      supportedCurrencies: ["USD", "AUD", "NZD"],
      credentials: {},
      config: {}
    }
  ];

  let created = 0;
  let skipped = 0;

  for (const gateway of gatewayData) {
    const existing = await db.select().from(paymentGateways).where(eq(paymentGateways.slug, gateway.slug)).limit(1);
    if (existing.length === 0) {
      await db.insert(paymentGateways).values(gateway);
      console.log(`✓ Created: ${gateway.displayName}`);
      created++;
    } else {
      console.log(`- Skipped (exists): ${gateway.displayName}`);
      skipped++;
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
