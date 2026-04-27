import { storage } from "./storage.js";

// Default flag state for fresh environments. These are INSERT-only on boot —
// admin UI edits to existing rows are preserved across deploys.
const FLAG_DEFAULTS = [
  {
    slug: "payment-stripe",
    enabled: false,
    displayName: "Stripe Payments",
    description: "Enable online credit card payments via Stripe"
  },
  {
    slug: "payment-bank-transfer",
    enabled: true,
    displayName: "Bank Transfer",
    description: "Enable manual bank transfer payment method"
  },
  {
    slug: "payment-cash-on-delivery",
    enabled: true,
    displayName: "Cash on Delivery",
    description: "Enable cash on delivery payment method"
  },
  {
    slug: "client-dashboard",
    enabled: false,
    displayName: "Client Dashboard",
    description: "Enable user-facing booking history and profile"
  },
  {
    slug: "reviews-system",
    enabled: false,
    displayName: "Reviews System",
    description: "Enable customer reviews and moderation"
  },
  {
    slug: "guest-reviews",
    enabled: true,
    displayName: "Guest Reviews",
    description: "Allow guests (non-logged-in users) to submit product reviews. Disable to restrict reviews to verified account holders only."
  },
  {
    slug: "newsletter",
    enabled: true,
    displayName: "Newsletter Signup",
    description: "Show the newsletter subscription form in the site footer and popup. Disabling hides the form and blocks new subscriptions via the API."
  }
];

// FIU-enforced flags — force-applied on every boot, overriding any admin UI
// state. Vanuatu Financial Intelligence Unit prohibits self-drive vehicle hire,
// so this flag MUST be false in production regardless of who toggled what.
// PR 2 will delete the flag entirely; until then this is the safety net.
const FIU_ENFORCED_FLAGS = [
  {
    slug: "vehicle-hire",
    enabled: false,
    displayName: "Vehicle Hire",
    description: "Disabled per Vanuatu FIU compliance — flag retained as a tombstone for PR 2 removal."
  }
];

export async function seedFlags() {
  for (const flag of FLAG_DEFAULTS) {
    const existing = await storage.getFeatureFlag(flag.slug);
    if (existing) continue;
    await storage.upsertFeatureFlag(flag);
    console.log(`[flags] seeded default: ${flag.slug} (${flag.enabled ? 'ON' : 'OFF'})`);
  }

  for (const flag of FIU_ENFORCED_FLAGS) {
    const existing = await storage.getFeatureFlag(flag.slug);
    if (existing && existing.enabled === flag.enabled) continue;
    await storage.upsertFeatureFlag(flag);
    console.log(`[flags] FIU enforced: ${flag.slug} -> ${flag.enabled ? 'ON' : 'OFF'}`);
  }
}

// Allow standalone execution: `npx tsx server/seed-flags.ts`
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedFlags()
    .then(() => {
      console.log("Feature flag seeding complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
