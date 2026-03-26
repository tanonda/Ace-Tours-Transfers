import "dotenv/config";
import { db, initializeDatabase } from "./server/db";
import { users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkUser() {
  await initializeDatabase();
  const email = "admin@acetoursvanuatu.com";
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    console.log(`❌ User ${email} NOT FOUND in database.`);
  } else {
    console.log(`✅ User ${email} found!`);
    console.log(`- ID: ${user.id}`);
    console.log(`- Username: ${user.username}`);
    console.log(`- Role: ${user.role}`);
    console.log(`- IsActive: ${user.isActive}`);
    console.log(`- Hash starts with: ${user.password.substring(0, 10)}...`);
    console.log(`- MFA Enabled: ${user.totpEnabled}`);
  }
  process.exit(0);
}

checkUser();
