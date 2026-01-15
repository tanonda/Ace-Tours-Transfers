
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
const urlObj = new URL(connectionString.replace("postgresql://", "https://").replace("postgres://", "https://"));
urlObj.username = "";
urlObj.password = "";
const endpoint = urlObj.toString().split('?')[0].replace(/\/+$/, "") + "/sql";

console.log(`🚀 Using HTTP SQL endpoint: ${endpoint}`);

async function query(sqlText) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'neon-connection-string': connectionString
    },
    body: JSON.stringify({ sql: sqlText })
  });
  
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Query failed (${response.status}): ${text}`);
  }
  
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

async function run() {
  try {
    console.log("1. Applying Schema Changes...");
    
    await query(`
      ALTER TABLE tours 
      ADD COLUMN IF NOT EXISTS adult_price_cents INTEGER,
      ADD COLUMN IF NOT EXISTS child_price_cents INTEGER;
    `);
    console.log("   ✅ Tours table updated.");

    await query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS total_amount_cents INTEGER,
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'VUV',
      ADD COLUMN IF NOT EXISTS adult_pax_total INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS child_pax_total INTEGER DEFAULT 0;
    `);
    console.log("   ✅ Bookings table updated.");

    await query(`
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
      );
    `);
    console.log("   ✅ BookingItems table created.");

    console.log("\n2. Starting Data Backfill...");
    
    // Backfill Tours
    const toursRes = await query(`SELECT id, price, child_price FROM tours`);
    const tours = toursRes.rows || [];
    for (const tour of tours) {
      const adult = parseAmount(tour.price);
      const child = parseAmount(tour.child_price);
      await query(`UPDATE tours SET adult_price_cents = ${adult}, child_price_cents = ${child} WHERE id = '${tour.id}'`);
      console.log(`   ✅ Migrated Tour ${tour.id}`);
    }

    // Backfill Bookings
    const bookingsRes = await query(`SELECT id, amount, guests, tour_id, tour_name FROM bookings`);
    const bookings = bookingsRes.rows || [];
    for (const b of bookings) {
      const amountCents = parseAmount(b.amount);
      await query(`UPDATE bookings SET total_amount_cents = ${amountCents}, adult_pax_total = ${b.guests}, child_pax_total = 0 WHERE id = '${b.id}'`);
      
      const itemsCheck = await query(`SELECT count(*) FROM booking_items WHERE booking_id = '${b.id}'`);
      if (parseInt(itemsCheck.rows[0].count) === 0) {
        const unitPrice = b.guests > 0 ? Math.round(amountCents / b.guests) : 0;
        await query(`
          INSERT INTO booking_items (id, booking_id, product_id, product_name, product_type, quantity, unit_price_cents, subtotal_cents, adult_pax, child_pax)
          VALUES ('bi_mig_${b.id}', '${b.id}', '${b.tour_id}', '${b.tour_name}', 'tour', ${b.guests}, ${unitPrice}, ${amountCents}, ${b.guests}, 0)
        `);
        console.log(`   ✅ Created item for Booking ${b.id}`);
      }
    }

    console.log("\n🏁 Migration and Backfill complete!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal Error:", err.message);
    process.exit(1);
  }
}

function parseAmount(text) {
  if (!text) return 0;
  // Handle cases like "$1,200.00" or "VUV 5000"
  const cleaned = text.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

run();
