import "dotenv/config";
import { db, initializeDatabase } from "./server/db";
import { sql } from "drizzle-orm";

async function inspectBookings() {
  await initializeDatabase();
  console.log("🚀 Inspecting 'bookings' table structure...");
  
  const res = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bookings'
  `);
  
  console.log("Current columns in 'bookings':");
  res.rows.forEach(row => {
    console.log(`- ${row.column_name} (${row.data_type})`);
  });
  
  process.exit(0);
}

inspectBookings();
