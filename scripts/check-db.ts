
import { db } from "../server/db";
import { contentBlocks } from "@shared/schema";

async function check() {
  try {
    console.log("Checking contentBlocks table...");
    const blocks = await db.select().from(contentBlocks).limit(1);
    console.log("Success:", blocks);
  } catch (error) {
    console.error("Error querying contentBlocks:", error);
  }
  process.exit(0);
}

check();
