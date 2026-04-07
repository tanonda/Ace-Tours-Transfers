import { initializeDatabase } from "./server/db";
import { users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkUser() {
  const { db } = await initializeDatabase();
  const email = "acetoursvanuatu@outlook.com";
  
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (user) {
    console.log("User found:");
    console.log(JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
      isActive: user.isActive,
    }, null, 2));
  } else {
    console.log("User not found.");
  }
  process.exit(0);
}

checkUser().catch((err) => {
  console.error(err);
  process.exit(1);
});
