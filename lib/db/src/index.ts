import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

const { Pool } = pg;

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "SUPABASE_DATABASE_URL or DATABASE_URL must be set.",
  );
}

export const pool = new Pool({
  connectionString,
  ssl: process.env.SUPABASE_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  // Fail fast if all connections are busy (prevents infinite hangs on cold start)
  connectionTimeoutMillis: 10_000,
  // Release idle connections so pgBouncer slots are freed between requests
  idleTimeoutMillis: 30_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
