import { storage } from "./storage.js";

async function seedFlags() {
  console.log("Seeding feature flags...");

  const flags = [
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

  for (const flag of flags) {
    await storage.upsertFeatureFlag(flag);
    console.log(`- Seeded flag: ${flag.slug} (${flag.enabled ? 'ON' : 'OFF'})`);
  }

  console.log("Feature flag seeding complete.");
}

seedFlags().catch(console.error);
