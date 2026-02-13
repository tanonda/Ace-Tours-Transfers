
import { db } from "../db.js";
import { sql } from "drizzle-orm";

async function main() {
    console.log("--- DB CONNECTIVITY TEST ---");
    try {
        const start = Date.now();
        console.log("Executing SELECT now()...");
        const res = await db.execute(sql`SELECT now() as time`);
        console.log(`✅ SUCCESS in ${Date.now() - start}ms:`, JSON.stringify(res.rows[0]));
        process.exit(0);
    } catch (e: any) {
        console.error("❌ FAILED!");
        console.error("Error Type:", typeof e);
        console.error("Error Name:", e.name);
        console.error("Error Message:", e.message);
        console.error("Full Error:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
        process.exit(1);
    }
}
main();
