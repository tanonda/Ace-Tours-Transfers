
import { execSync } from 'child_process';
import fs from 'fs';
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
const urlObj = new URL(connectionString.replace("postgresql://", "https://").replace("postgres://", "https://"));
urlObj.username = "";
urlObj.password = "";
const endpoint = urlObj.toString().split('?')[0].replace(/\/+$/, "") + "/sql";

console.log("🚀 Starting Curl-powered Migrator...");

function query(sqlText) {
  // Sanitize SQL text for the JSON payload
  const cleanedSql = sqlText.trim();
  const payload = JSON.stringify({ query: cleanedSql });
  fs.writeFileSync('payload.json', payload);
  
  const cmd = `curl -s -X POST -H "Content-Type: application/json" -H "neon-connection-string: ${connectionString}" --data-binary @payload.json ${endpoint}`;
  
  try {
    const output = execSync(cmd).toString();
    if (!output) throw new Error("Empty response from curl");
    
    let result;
    try {
      result = JSON.parse(output);
    } catch (e) {
      if (output.includes("query is not supported")) {
        throw new Error(`Database error: "query is not supported" - check if query is empty or malformed: [${cleanedSql}]`);
      }
      throw new Error(`Invalid JSON response: ${output.substring(0, 100)}`);
    }

    if (result.message || result.error) {
       throw new Error(result.message || result.error || "Unknown database error");
    }
    return result;
  } catch (e) {
    throw new Error(`Query execution failed: ${e.message}`);
  } finally {
    if (fs.existsSync('payload.json')) fs.unlinkSync('payload.json');
  }
}

async function run() {
  try {
    console.log("1. Schema Changes...");
    query(`ALTER TABLE tours ADD COLUMN IF NOT EXISTS adult_price_cents INTEGER, ADD COLUMN IF NOT EXISTS child_price_cents INTEGER;`);
    query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount_cents INTEGER, ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'VUV', ADD COLUMN IF NOT EXISTS adult_pax_total INTEGER DEFAULT 1, ADD COLUMN IF NOT EXISTS child_pax_total INTEGER DEFAULT 0;`);
    query(`
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
    console.log("   ✅ Schema OK.");

    console.log("2. Backfill Tours...");
    const toursRes = query(`SELECT id, price, child_price FROM tours`);
    const tours = Array.isArray(toursRes) ? toursRes : toursRes.rows;
    
    if (!tours) {
      throw new Error("Tours result did not contain rows or array");
    }

    for (const tour of tours) {
      const adult = parseAmount(tour.price);
      const child = parseAmount(tour.child_price);
      query(`UPDATE tours SET adult_price_cents = ${adult}, child_price_cents = ${child} WHERE id = '${tour.id}'`);
      console.log(`   ✅ Migrated Tour ${tour.id}`);
    }

    console.log("3. Backfill Bookings...");
    const bookingsRes = query(`SELECT id, amount, guests, tour_id, tour_name FROM bookings`);
    const bookings = Array.isArray(bookingsRes) ? bookingsRes : bookingsRes.rows;

    for (const b of bookings) {
      const amountCents = parseAmount(b.amount);
      query(`UPDATE bookings SET total_amount_cents = ${amountCents}, adult_pax_total = ${b.guests}, child_pax_total = 0 WHERE id = '${b.id}'`);
      
      const itemsCountRes = query(`SELECT count(*) FROM booking_items WHERE booking_id = '${b.id}'`);
      const icRes = Array.isArray(itemsCountRes) ? itemsCountRes[0] : (itemsCountRes.rows ? itemsCountRes.rows[0] : null);
      if (!icRes) throw new Error(`Could not get item count for booking ${b.id}`);
      
      const itemsCount = icRes.count;
      if (parseInt(itemsCount) === 0) {
        const unitPrice = b.guests > 0 ? Math.round(amountCents / b.guests) : 0;
        query(`
          INSERT INTO booking_items (id, booking_id, product_id, product_name, product_type, quantity, unit_price_cents, subtotal_cents, adult_pax, child_pax)
          VALUES ('bi_mig_${b.id}', '${b.id}', '${b.tour_id}', '${b.tour_name}', 'tour', ${b.guests}, ${unitPrice}, ${amountCents}, ${b.guests}, 0)
        `);
        console.log(`   ✅ Created item for Booking ${b.id}`);
      }
    }

    console.log("🏁 Migration and Backfill complete via Curl!");
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
