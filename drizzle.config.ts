import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: "ep-delicate-king-am3aopbg-pooler.c-5.us-east-1.aws.neon.tech",
    port: 5432,
    user: "neondb_owner",
    password: "REDACTED",
    database: "neondb",
    ssl: {
      servername: "ep-delicate-king-am3aopbg-pooler.c-5.us-east-1.aws.neon.tech",
      rejectUnauthorized: false
    }
  },
});
