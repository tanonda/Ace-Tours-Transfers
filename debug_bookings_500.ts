import "dotenv/config";
import { db, initializeDatabase } from "./server/db";
import { storage } from "./server/storage";
import { payments } from "./shared/schema";

async function debugBookings() {
  await initializeDatabase();
  console.log("🚀 Debugging bookings fetch...");
  
  try {
    console.log("1. Fetching bookings from storage...");
    const bookings = await storage.getBookings(false);
    console.log(`   ✅ Success: Found ${bookings.length} bookings.`);
    
    console.log("2. Fetching payments from db directly...");
    const allPayments = await db.select().from(payments);
    console.log(`   ✅ Success: Found ${allPayments.length} payments.`);
    
    console.log("3. Fetching payment gateways from storage...");
    const allGateways = await storage.getPaymentGateways();
    console.log(`   ✅ Success: Found ${allGateways.length} gateways.`);
  } catch (err: any) {
    console.error("❌ FAILED with error:");
    console.error(err);
    if (err.stack) console.error(err.stack);
  }
  process.exit(0);
}

debugBookings();
