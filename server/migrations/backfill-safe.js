
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

// Manual backfill logic using pure JS and neon()
async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  
  const sql = neon(url);
  console.log("🚀 Starting data backfill via pure Node.js + Neon driver...");

  try {
    // 1. Migrate Tours
    console.log("Migrating tours...");
    const tours = await sql`SELECT id, price, child_price FROM tours`;
    for (const tour of tours) {
      const adultCents = parseAmount(tour.price);
      const childCents = parseAmount(tour.child_price);
      await sql`UPDATE tours SET adult_price_cents = ${adultCents}, child_price_cents = ${childCents} WHERE id = ${tour.id}`;
      console.log(`   ✅ Tour ${tour.id}: ${tour.price} -> ${adultCents}`);
    }

    // 2. Migrate Bookings
    console.log("Migrating bookings...");
    const bookings = await sql`SELECT id, amount, guests, tour_id, tour_name FROM bookings`;
    for (const b of bookings) {
      const amountCents = parseAmount(b.amount);
      await sql`UPDATE bookings SET total_amount_cents = ${amountCents}, adult_pax_total = ${b.guests}, child_pax_total = 0 WHERE id = ${b.id}`;
      
      // Check if item exists
      const items = await sql`SELECT id FROM booking_items WHERE booking_id = ${b.id}`;
      if (items.length === 0) {
        const itemId = `bi_mig_${b.id}`;
        const unitPrice = b.guests > 0 ? Math.round(amountCents / b.guests) : 0;
        await sql`
          INSERT INTO booking_items (id, booking_id, product_id, product_name, product_type, quantity, unit_price_cents, subtotal_cents, adult_pax, child_pax)
          VALUES (${itemId}, ${b.id}, ${b.tour_id}, ${b.tour_name}, 'tour', ${b.guests}, ${unitPrice}, ${amountCents}, ${b.guests}, 0)
        `;
        console.log(`   ✅ Created item for booking ${b.id}`);
      }
    }

    console.log("🏁 Backfill complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  }
}

function parseAmount(text) {
  if (!text) return 0;
  const num = parseFloat(text.replace(/[^0-9.]/g, ''));
  return isNaN(num) ? 0 : Math.round(num * 100);
}

run();
