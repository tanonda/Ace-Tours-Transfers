import "dotenv/config";
import { db } from "../server/db.js";
import { sql } from "drizzle-orm";

async function dropConstraint() {
    try {
        console.log("Dropping conflicting constraint: bookings_idempotency_key_unique");
        await db.execute(sql`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_idempotency_key_unique`);
        console.log("Constraint dropped successfully (if it existed)");
    } catch (error) {
        console.error("Failed to drop constraint:", error);
    } finally {
        process.exit(0);
    }
}

dropConstraint();
