import { storage } from "./storage.js";

async function seedFlags() {
  console.log("Seeding feature flags...");

  const flags = [
    {
      slug: "payment-stripe",
      enabled: true,
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
      slug: "vehicle-hire",
      enabled: true,
      displayName: "Vehicle Hire",
      description: "Enable vehicle and bus hire services"
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
    }
  ];

  for (const flag of flags) {
    await storage.upsertFeatureFlag(flag);
    console.log(`- Seeded flag: ${flag.slug} (${flag.enabled ? 'ON' : 'OFF'})`);
  }

  console.log("Feature flag seeding complete.");
}

seedFlags().catch(console.error);
