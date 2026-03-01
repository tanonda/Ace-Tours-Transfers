import { db } from '../server/db.js';
import { featureFlags } from '../shared/schema.js';
import { eq, inArray } from 'drizzle-orm';

async function cleanupFlags() {
    try {
        const deleted = await db.delete(featureFlags).where(
            inArray(featureFlags.slug, ['payment-stripe', 'payment-bank-transfer'])
        ).returning();
        console.log("Deleted flags:", deleted);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        process.exit(0);
    }
}

cleanupFlags();
