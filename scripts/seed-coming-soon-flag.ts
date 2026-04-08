import "dotenv/config";
import { db } from "../server/db.js";
import { featureFlags } from "../shared/schema.js";

async function main() {
  try {
    console.log("Seeding coming-soon feature flag...");

    await db
      .insert(featureFlags)
      .values({
        slug: "coming-soon",
        displayName: "Coming Soon Mode",
        description:
          "When enabled, the public site shows the Coming Soon page. Staff/admin users can still access the full site via /staff-access.",
        enabled: false, // OFF by default — site is live
      })
      .onConflictDoUpdate({
        target: featureFlags.slug,
        set: {
          displayName: "Coming Soon Mode",
          description:
            "When enabled, the public site shows the Coming Soon page. Staff/admin users can still access the full site via /staff-access.",
          updatedAt: new Date(),
        },
      });

    console.log("✅ coming-soon flag seeded (enabled: false)");
  } catch (error: any) {
    console.error("Seeding failed:", error);
  } finally {
    process.exit(0);
  }
}

main();
