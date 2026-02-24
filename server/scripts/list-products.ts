
import { db } from "../db.js";
import { sql } from "drizzle-orm";

async function listProducts() {
    const result = await db.execute(sql`
    SELECT 
      t.id, 
      t.title, 
      t.category, 
      t.is_active,
      (SELECT count(*) FROM tour_instances WHERE tour_id = t.id) as instances,
      (SELECT count(*) FROM bookings WHERE tour_id = t.id) as bookings
    FROM tours t
    ORDER BY t.category, t.title
  `);

    console.log(JSON.stringify(result.rows, null, 2));
}

listProducts().catch(console.error);
