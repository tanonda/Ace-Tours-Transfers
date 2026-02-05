
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function run() {
  const url = process.env.DATABASE_URL.split('?')[0];
  const sql = neon(url);
  console.log("🚀 Starting granular backfill via Neon driver (One by One)...");

  try {
    // 1. Fetch Tour IDs
    console.log("Fetching tour IDs...");
    const tourIds = await sql`SELECT id FROM tours`;
    console.log(`Found ${tourIds.length} tours.`);

    for (const { id } of tourIds) {
      const tour = (await sql`SELECT price, child_price FROM tours WHERE id = ${id}`)[0];
      const adult = parseAmount(tour.price);
      const child = parseAmount(tour.child_price);
      await sql`UPDATE tours SET adult_price_cents = ${adult}, child_price_cents = ${child} WHERE id = ${id}`;
      console.log(`   ✅ Migrated Tour ${id}: ${tour.price} -> ${adult}`);
    }

    // 2. Fetch Booking IDs
    console.log("\nFetching booking IDs...");
    const bookingIds = await sql`SELECT id FROM bookings`;
    console.log(`Found ${bookingIds.length} bookings.`);

    for (const { id } of bookingIds) {
      const b = (await sql`SELECT amount, guests, tour_id, tour_name FROM bookings WHERE id = ${id}`)[0];
      const amountCents = parseAmount(b.amount);
      await sql`UPDATE bookings SET total_amount_cents = ${amountCents}, adult_pax_total = ${b.guests}, child_pax_total = 0 WHERE id = ${id}`;
      
      const items = await sql`SELECT id FROM booking_items WHERE booking_id = ${id}`;
      if (items.length === 0) {
        const itemId = `bi_mig_${id}`;
        const unitPrice = b.guests > 0 ? Math.round(amountCents / b.guests) : 0;
        await sql`
          INSERT INTO booking_items (id, booking_id, product_id, product_name, product_type, quantity, unit_price_cents, subtotal_cents, adult_pax, child_pax)
          VALUES (${itemId}, ${id}, ${b.tour_id}, ${b.tour_name}, 'tour', ${b.guests}, ${unitPrice}, ${amountCents}, ${b.guests}, 0)
        `;
        console.log(`   ✅ Created item for Booking ${id}`);
      } else {
        console.log(`   ⏩ Item exists for Booking ${id}`);
      }
    }

    console.log("\n🏁 Granular Backfill complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal Error:", err.message);
    process.exit(1);
  }
}

function parseAmount(text) {
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

run();
