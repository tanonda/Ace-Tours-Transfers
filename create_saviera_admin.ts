import { initializeDatabase } from "./server/db";
import { users } from "./shared/schema";
import bcrypt from "bcryptjs";

async function createAdminUser() {
  const { db } = await initializeDatabase();
  
  const name = "Saviera Alexis";
  const email = "acetoursvanuatu@outlook.com";
  const password = "Salexis2026#";
  const role = "admin";
  const username = "saviera_alexis";

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const [newAdmin] = await db.insert(users).values({
      name,
      email: email.trim().toLowerCase(),
      username,
      password: hashedPassword,
      role,
    }).returning();

    console.log("Admin user created successfully:");
    console.log(JSON.stringify({
      id: newAdmin.id,
      name: newAdmin.name,
      email: newAdmin.email,
      role: newAdmin.role,
      username: newAdmin.username,
    }, null, 2));
  } catch (error: any) {
    if (error.code === '23505') { // Unique violation
       console.error("Error: User with this email or username already exists.");
    } else {
       console.error("Error creating admin user:", error);
    }
  }
  
  process.exit(0);
}

createAdminUser().catch((err) => {
  console.error(err);
  process.exit(1);
});
