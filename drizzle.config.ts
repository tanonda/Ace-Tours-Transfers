import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: "54.206.85.193",
    port: 5432,
    user: "neondb_owner",
    password: process.env.DB_PASSWORD!,
    database: "neondb",
    ssl: {
      servername: "ep-bitter-frog-a7zxak3x-pooler.ap-southeast-2.aws.neon.tech",
      rejectUnauthorized: false
    }
  },
});
