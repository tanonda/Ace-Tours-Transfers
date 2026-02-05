
import pg from 'pg';
const { Pool } = pg;
import "dotenv/config";

async function runManualMigration() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true
  });

  console.log("🚀 Starting manual schema migration via direct PG driver (TCP/5432)...");

  const client = await pool.connect();
  try {
    // 1. Update tours table with numeric cents
    console.log("Updating tours table...");
    await client.query(`
      ALTER TABLE tours 
      ADD COLUMN IF NOT EXISTS adult_price_cents INTEGER,
      ADD COLUMN IF NOT EXISTS child_price_cents INTEGER;
    `);

    // 2. Update bookings table with new fields
    console.log("Updating bookings table...");
    await client.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS total_amount_cents INTEGER,
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'VUV',
      ADD COLUMN IF NOT EXISTS adult_pax_total INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS child_pax_total INTEGER DEFAULT 0;
    `);

    // 3. Create booking_items table
    console.log("Creating booking_items table...");
    await client.query(`
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

    console.log("✅ Manual migration successful!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Manual migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runManualMigration();
