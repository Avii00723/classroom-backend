import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

// This network's IPv6 path to Neon times out while IPv4 is healthy. Ensure
// Node tries the reachable address family first for database requests.
setDefaultResultOrder("ipv4first");
setDefaultAutoSelectFamily(false);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined in .env");
}

// This API uses independent, one-shot queries, so the HTTP driver avoids a
// persistent WebSocket connection that this network times out.
export const db = drizzle({ client: neon(databaseUrl) });

const retryDelayMs = [250, 750];

const isTransientConnectionError = (error: unknown) => {
  const messages: string[] = [];
  let current: unknown = error;

  for (let depth = 0; current && depth < 4; depth += 1) {
    if (current instanceof Error) messages.push(current.message);
    current = typeof current === "object" && current !== null && "cause" in current
      ? (current as { cause?: unknown }).cause
      : undefined;
  }

  return /fetch failed|connecttimeout|etimedout|econnreset|enotfound/i.test(messages.join(" "));
};

export async function withDatabaseRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelayMs.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientConnectionError(error) || attempt === retryDelayMs.length) break;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs[attempt]));
    }
  }

  throw lastError;
}
