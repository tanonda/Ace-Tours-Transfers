import "dotenv/config";
import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Dropping all tables...");
  await db.execute(sql`
    DO $$ DECLARE
        r RECORD;
    BEGIN
    EXECUTE 'DROP TABLE IF EXISTS "drizzle_migrations" CASCADE';
    EXECUTE 'DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE';
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
    END $$;
  `);
  console.log("Tables dropped!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
