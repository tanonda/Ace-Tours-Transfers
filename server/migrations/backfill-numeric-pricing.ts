import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { products, bookings, bookingItems } from "../../shared/schema.js";
import { PriceResolver } from "../domain/pricing/PriceResolver.js";
import { eq } from "drizzle-orm";
import "dotenv/config";

async function runBackfill() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);
  console.log("🚀 Starting numeric price backfill migration via Neon HTTP driver...");

  // 1. Migrate Tours
  const allProducts = await db.select().from(products);
  console.log(`📋 Found ${allProducts.length} tours to migrate.`);

  for (const tour of allProducts) {
    const adultPriceCents = PriceResolver.parseAmountTextToCents(tour.price);
    const childPriceCents = PriceResolver.parseAmountTextToCents(tour.childPrice);

    await db.update(products)
      .set({ adultPriceCents, childPriceCents })
      .where(eq(products.id, tour.id));

    console.log(`   ✅ Migrated Product ${tour.id}: ${tour.price} -> ${adultPriceCents} cents`);
  }

  // 2. Migrate Bookings & Create BookingItems
  const allBookings = await db.select().from(bookings);
  console.log(`📋 Found ${allBookings.length} bookings to migrate.`);

  for (const booking of allBookings) {
    const totalAmountCents = PriceResolver.parseAmountTextToCents(booking.amount);

    // Update Booking header
    await db.update(bookings)
      .set({
        totalAmountCents,
        currency: 'VUV',
        adultPaxTotal: booking.guests, // Assume all guests were adults for legacy data
        childPaxTotal: 0
      })
      .where(eq(bookings.id, booking.id));

    // Check if BookingItems already exist (idempotency)
    const existingItems = await db.select().from(bookingItems).where(eq(bookingItems.bookingId, booking.id));

    if (existingItems.length === 0) {
      // Create a single BookingItem for the legacy booking
      const tour = allProducts.find(t => t.id === booking.tourId);

      await db.insert(bookingItems).values({
        id: `bi_mig_${booking.id}`,
        bookingId: booking.id,
        productId: booking.tourId,
        productName: booking.tourName,
        productType: tour?.category || 'tour',
        quantity: booking.guests,
        unitPriceCents: booking.guests > 0 ? Math.round(totalAmountCents / booking.guests) : 0,
        subtotalCents: totalAmountCents,
        adultPax: booking.guests,
        childPax: 0
      });
      console.log(`   ✅ Created BookingItem for Booking ${booking.id}`);
    } else {
      console.log(`   ⏩ Skipping BookingItem for ${booking.id} (already exists)`);
    }
  }

  console.log("🏁 Migration complete!");
}

runBackfill().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
