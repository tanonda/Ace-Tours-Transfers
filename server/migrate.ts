import "dotenv/config";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { db, pool } from "./db.js";

async function main() {
  console.log("Running migrations...");
  console.log("DATABASE_URL used for migration:", process.env.DATABASE_URL ? "Configured" : "Not configured");
  
  await migrate(db, { migrationsFolder: "migrations" });
  
  console.log("Migrations complete!");
  
  // Neon pool might need explicit closing or it might hang script? 
  // pool is from ./db.js
  // pool.end() might be needed.
  // But db.js exports pool. Let's start with process.exit which forces close.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
