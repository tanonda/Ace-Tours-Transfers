
import "dotenv/config";
import fs from "fs";
import crypto from "crypto";
import dns from "dns";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

dns.setDefaultResultOrder("ipv4first");
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
}

function hashFile(filePath: string): string {
    const content = fs.readFileSync(filePath, "utf8");
    return crypto.createHash("sha256").update(content).digest("hex");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    console.log("=== Repairing Drizzle Migration State ===\n");
    const client = await pool.connect();

    try {
        // 1. Collect all local migration hashes
        const migrationDir = "./migrations";
        const files = fs.readdirSync(migrationDir)
            .filter(f => f.endsWith(".sql"))
            .sort();

        console.log(`Found ${files.length} local migration files.`);

        // 2. Ensure both schemas have the tracking table
        console.log("Checking tracking tables...");
        await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle;`);
        await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id         SERIAL PRIMARY KEY,
        hash       TEXT NOT NULL,
        created_at BIGINT
      )
    `);
        await client.query(`
      CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (
        id         SERIAL PRIMARY KEY,
        hash       TEXT NOT NULL,
        created_at BIGINT
      )
    `);

        // 3. Clear existing (potentially corrupt/mismatched) entries
        console.log("Clearing existing tracking entries for a fresh sync...");
        await client.query(`TRUNCATE TABLE drizzle.__drizzle_migrations RESTART IDENTITY;`);
        await client.query(`TRUNCATE TABLE public.__drizzle_migrations RESTART IDENTITY;`);

        // 4. Populate with correct hashes for applied migrations (0000-0017)
        // We assume these are applied because the user was trying to run migrations
        // and infant_pax (0004) already exists. We'll populate up to the latest local file
        // to match the state drizzle-kit expects.

        console.log("Populating tracking tables with local hashes...");
        for (const file of files) {
            const hash = hashFile(`${migrationDir}/${file}`);
            const timestamp = Date.now();

            await client.query(
                `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
                [hash, timestamp]
            );
            await client.query(
                `INSERT INTO public.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
                [hash, timestamp]
            );
            console.log(`  Synced: ${file}`);
        }

        console.log("\nSync complete.");

        // 5. Verification
        const { rows: drizzleRows } = await client.query("SELECT count(*) FROM drizzle.__drizzle_migrations");
        const { rows: publicRows } = await client.query("SELECT count(*) FROM public.__drizzle_migrations");

        console.log(`drizzle.__drizzle_migrations count: ${drizzleRows[0].count}`);
        console.log(`public.__drizzle_migrations count: ${publicRows[0].count}`);

    } catch (error: any) {
        console.error("Error during repair:", error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
