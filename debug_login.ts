import "dotenv/config";
import { initializeDatabase } from "./server/db";
import { storage } from "./server/storage";
import { AuthDomainService } from "./server/domain/users/auth.domain-service";

async function testLogin() {
  await initializeDatabase();
  const authService = new AuthDomainService(storage);
  
  const email = "admin@acetoursvanuatu.com";
  const password = "Salexis2026";
  
  console.log(`[TEST] Attempting login for ${email}...`);
  try {
    const result = await authService.login(email, password);
    if (result) {
      console.log("✅ Login successful in domain service!");
      console.log(`User ID: ${result.user.id}, Role: ${result.user.role}`);
    } else {
      console.log("❌ Login failed: Domain service returned null (user not found or password mismatch).");
      
      // Detailed probe
      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user) {
        console.log("   -> PROBE: User not found in storage by email.");
      } else {
        console.log("   -> PROBE: User found in storage. Checking password...");
        const bcrypt = await import("bcryptjs");
        const match = await bcrypt.compare(password, user.password);
        console.log(`   -> PROBE: Password match result: ${match}`);
      }
    }
  } catch (e: any) {
    console.log(`❌ Login crashed: ${e.message}`);
  }
  process.exit(0);
}

testLogin();
