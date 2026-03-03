import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
    host: "54.206.85.193",
    port: 5432,
    user: "neondb_owner",
    password: process.env.DB_PASSWORD,
    database: "neondb",
    ssl: { servername: "ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech", rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
});

async function main() {
    const client = await pool.connect();
    try {
        // Check which 0016 columns exist
        const res = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='tours' 
      AND column_name IN ('itinerary_intro','itinerary_stops','meeting_point','included_items','excluded_items',
        'cancellation_policy','booking_cutoff_hours','additional_info','support_email','support_phone',
        'product_code','traveler_photos','meeting_point_map_url','pickup_instructions','operating_hours')
      ORDER BY column_name
    `);
        console.log("Existing migration 0016 columns:", res.rows.map((r: any) => r.column_name));
        console.log("Expected 15 columns, found:", res.rows.length);

        if (res.rows.length < 15) {
            console.log("\nMissing columns detected! Applying migration 0016 SQL...");
            await client.query(`
        ALTER TABLE tours
          ADD COLUMN IF NOT EXISTS itinerary_stops       jsonb DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS itinerary_intro        text,
          ADD COLUMN IF NOT EXISTS meeting_point          text,
          ADD COLUMN IF NOT EXISTS meeting_point_map_url  text,
          ADD COLUMN IF NOT EXISTS pickup_instructions    text,
          ADD COLUMN IF NOT EXISTS operating_hours        text,
          ADD COLUMN IF NOT EXISTS included_items         jsonb DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS excluded_items         jsonb DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS cancellation_policy    text,
          ADD COLUMN IF NOT EXISTS booking_cutoff_hours   integer DEFAULT 24,
          ADD COLUMN IF NOT EXISTS additional_info        jsonb DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS support_email          text,
          ADD COLUMN IF NOT EXISTS support_phone          text,
          ADD COLUMN IF NOT EXISTS product_code           text,
          ADD COLUMN IF NOT EXISTS traveler_photos        jsonb DEFAULT '[]'::jsonb
      `);
            console.log("Tours table columns applied!");

            await client.query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS photo_url text`);
            console.log("Reviews photo_url column applied!");
        } else {
            console.log("All 0016 columns already exist.");
        }

        // Verify
        const verify = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='tours' AND column_name='itinerary_intro'
    `);
        console.log("\nVerification - itinerary_intro exists:", verify.rows.length > 0);
    } finally {
        client.release();
        await pool.end();
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
