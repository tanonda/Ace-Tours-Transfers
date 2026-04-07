import { initializeDatabase } from "./server/db";
import { users, type User } from "./shared/schema";
import { desc } from "drizzle-orm";

async function listUsers() {
  const { db } = await initializeDatabase();
  
  const allUsers = await db.query.users.findMany({
    limit: 10,
    orderBy: desc(users.createdAt),
  });

  console.log("Recent users:");
  console.log(JSON.stringify(allUsers.map((u: User) => ({
    username: u.username,
    email: u.email,
    role: u.role,
    name: u.name,
  })), null, 2));
  
  process.exit(0);
}

listUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});
