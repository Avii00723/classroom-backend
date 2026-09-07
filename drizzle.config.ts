import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import process from "process";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_UNPOOLED is not set in .env");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Drizzle migrations require Neon's direct (non-pooled) connection.
    url: databaseUrl,
  },
});
