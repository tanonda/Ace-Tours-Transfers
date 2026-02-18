import "dotenv/config";
import { db } from "../server/db.js";
import { bookings, bookingItems, bookingAddons, availabilityHolds } from "../shared/schema.js";
import { eq, or, like, and } from "drizzle-orm";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[CLEANUP] Starting cleanup... ${dryRun ? "(DRY RUN)" : ""}`);

  // Patterns for test data
  const testEmailPatterns = [
    "admin@acetours.vu",
    "test@",
    "@example.com"
  ];

  const testNamePatterns = [
    "Test User",
    "Demo User",
    "Admin User"
  ];

  // Find bookings to delete
  const conditions = testEmailPatterns.map(p => like(bookings.customerEmail, `%${p}%`));
  conditions.push(...testNamePatterns.map(p => like(bookings.customerName, `%${p}%`)));

  const targetBookings = await db.select().from(bookings).where(or(...conditions));

  console.log(`[CLEANUP] Found ${targetBookings.length} test bookings.`);

  if (targetBookings.length === 0) {
    console.log("[CLEANUP] No test data found.");
    process.exit(0);
  }

  if (dryRun) {
    targetBookings.forEach(b => {
      console.log(`[DRY RUN] Would delete booking: ${b.id} (${b.customerName} - ${b.customerEmail})`);
    });
  } else {
    for (const b of targetBookings) {
      console.log(`[CLEANUP] Deleting booking: ${b.id}...`);
      
      // Delete child records first if not handled by cascade (schema.ts shows cascade for items and addons)
      // availability_holds references tourInstanceId, but bookings references holdId.
      // We should release the hold if applicable.
      
      await db.delete(bookings).where(eq(bookings.id, b.id));
    }
    console.log("[CLEANUP] Database cleaned.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
