import "dotenv/config";
import { db } from "../server/db.js";
import { paymentGateways } from "../shared/schema.js";

async function run() {
    try {
        const gateways = await db.select().from(paymentGateways);
        console.log("Gateways:", gateways.map(g => ({ slug: g.slug, active: g.active })));
    } catch (err: any) {
        console.error("CRASH:", err);
    }
    process.exit(0);
}

run();
