import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined in .env");
}

neonConfig.webSocketConstructor = ws;
// Drizzle issues individual pool queries. Disable the HTTP fast path because
// this environment cannot reach Neon's HTTP endpoint.
neonConfig.poolQueryViaFetch = false;

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle({ client: pool });
