import "dotenv/config";
import { db, initializeDatabase } from "./server/db";
import { users } from "./shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function forceResetAdmin() {
  await initializeDatabase();
  const email = "admin@acetoursvanuatu.com";
  const password = "Salexis2026";
  const hashedPassword = await bcrypt.hash(password, 10);
  
  console.log(`[RESET] Attempting to reset/update admin: ${email}`);
  
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (existing) {
    console.log(`[RESET] Found existing user with ID: ${existing.id}. Updating password...`);
    await db.update(users).set({ 
      password: hashedPassword,
      isActive: true,
      role: 'admin',
      updatedAt: new Date()
    }).where(eq(users.id, existing.id));
    console.log("✅ Password updated successfully.");
  } else {
    console.log("[RESET] User not found. Creating new admin user...");
    await db.insert(users).values({
      username: email,
      email: email,
      name: "Site Admin",
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });
    console.log("✅ New admin user created.");
  }
  process.exit(0);
}

forceResetAdmin();
