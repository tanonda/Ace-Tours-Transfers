
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function run() {
  const url = process.env.DATABASE_URL.split('?')[0];
  const sql = neon(url);
  console.log("🚀 Starting granular backfill via Neon driver...");

  try {
    // 1. Schema Changes (if not done)
    console.log("Applying Schema Changes...");
    await sql`ALTER TABLE tours ADD COLUMN IF NOT EXISTS adult_price_cents INTEGER`;
    await sql`ALTER TABLE tours ADD COLUMN IF NOT EXISTS child_price_cents INTEGER`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount_cents INTEGER`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'VUV'`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS adult_pax_total INTEGER DEFAULT 1`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS child_pax_total INTEGER DEFAULT 0`;
    await sql`
      CREATE TABLE IF NOT EXISTS booking_items (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id VARCHAR(255) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        product_id VARCHAR(255) NOT NULL,
        product_type TEXT NOT NULL,
        product_name TEXT NOT NULL,
        unit_price_cents INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        subtotal_cents INTEGER NOT NULL,
        adult_pax INTEGER NOT NULL DEFAULT 0,
        child_pax INTEGER NOT NULL DEFAULT 0,
        date TIMESTAMP,
        slot TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log("✅ Schema OK.");

    // 2. Backfill Tours
    console.log("Fetching tour IDs...");
    const tourIds = await sql`SELECT id FROM tours`;
    for (const { id } of tourIds) {
      const tour = (await sql`SELECT price, child_price FROM tours WHERE id = ${id}`)[0];
      const adult = parseAmount(tour.price);
      const child = parseAmount(tour.child_price);
      await sql`UPDATE tours SET adult_price_cents = ${adult}, child_price_cents = ${child} WHERE id = ${id}`;
      console.log(`   ✅ Migrated Tour ${id}`);
    }

    // 3. Backfill Bookings
    console.log("Fetching booking IDs...");
    const bookingIds = await sql`SELECT id FROM bookings`;
    for (const { id } of bookingIds) {
      const b = (await sql`SELECT amount, guests, tour_id, tour_name FROM bookings WHERE id = ${id}`)[0];
      const amountCents = parseAmount(b.amount);
      await sql`UPDATE bookings SET total_amount_cents = ${amountCents}, adult_pax_total = ${b.guests}, child_pax_total = 0 WHERE id = ${id}`;
      
      const itemsCount = (await sql`SELECT count(*) FROM booking_items WHERE booking_id = ${id}`)[0].count;
      if (parseInt(itemsCount) === 0) {
        const unitPrice = b.guests > 0 ? Math.round(amountCents / b.guests) : 0;
        await sql`
          INSERT INTO booking_items (id, booking_id, product_id, product_name, product_type, quantity, unit_price_cents, subtotal_cents, adult_pax, child_pax)
          VALUES (${`bi_mig_${id}`}, ${id}, ${b.tour_id}, ${b.tour_name}, 'tour', ${b.guests}, ${unitPrice}, ${amountCents}, ${b.guests}, 0)
        `;
        console.log(`   ✅ Created item for Booking ${id}`);
      }
    }

    console.log("🏁 Granular Backfill complete!");
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
