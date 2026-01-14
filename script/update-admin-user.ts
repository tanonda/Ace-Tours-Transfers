import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function updateAdminUser() {
  try {
    console.log("Starting admin user update...");

    // First, let's see all users
    const allUsers = await db.select().from(users);
    console.log("Current users in database:");
    allUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`);
    });

    // Find the admin user by current email
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@acetours.vu"));

    if (!adminUser) {
      console.error("Admin user with email 'admin@acetours.vu' not found");
      process.exit(1);
    }

    console.log(`Found admin user: ${adminUser.name} (${adminUser.email})`);

    // Check if the target email already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "markmal64@gmail.com"));

    if (existingUser) {
      console.log(`User with email 'markmal64@gmail.com' already exists: ${existingUser.name}`);
      console.log("Swapping emails to avoid foreign key conflicts...");

      // First, temporarily change the existing user's email
      const tempEmail = `temp_${Date.now()}@temp.com`;
      await db
        .update(users)
        .set({ email: tempEmail })
        .where(eq(users.id, existingUser.id));
      console.log(`Existing user email changed to: ${tempEmail}`);
    }

    // Hash the new password
    const newPassword = "Ace2025";
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    console.log("Password hashed successfully");

    // Update the user with new email and password
    const [updatedUser] = await db
      .update(users)
      .set({
        email: "markmal64@gmail.com",
        password: hashedPassword,
      })
      .where(eq(users.id, adminUser.id))
      .returning();

    if (updatedUser) {
      console.log("Admin user updated successfully!");
      console.log(`New email: ${updatedUser.email}`);
      console.log("Password reset to: Ace2025");
    } else {
      console.error("Failed to update admin user");
      process.exit(1);
    }

  } catch (error) {
    console.error("Error updating admin user:", error);
    process.exit(1);
  } finally {
    // Close the database connection
    process.exit(0);
  }
}

// Run the script
updateAdminUser();