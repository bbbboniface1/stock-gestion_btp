import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env") });

function resolveMigrationUrl(url: string): string {
  if (process.env.SUPABASE_DIRECT_URL) {
    return process.env.SUPABASE_DIRECT_URL;
  }

  try {
    const parsed = new URL(url);
    const ref = parsed.username.includes(".")
      ? parsed.username.split(".")[1]
      : null;

    if (ref && parsed.hostname.includes("pooler.supabase.com")) {
      const direct = new URL(url);
      direct.hostname = `db.${ref}.supabase.co`;
      direct.port = "5432";
      direct.username = "postgres";
      direct.searchParams.delete("pgbouncer");
      console.log(`Using direct Supabase connection: db.${ref}.supabase.co:5432`);
      return direct.toString();
    }
  } catch {
    // Keep original URL
  }

  return url;
}

const rawUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("SUPABASE_DATABASE_URL or DATABASE_URL must be set.");
  process.exit(1);
}

const connectionString = resolveMigrationUrl(rawUrl);
const sqlPath = path.resolve(__dirname, "../../../docs/sql/production_schema_v2.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  console.log("Applying migration:", sqlPath);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migration applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});