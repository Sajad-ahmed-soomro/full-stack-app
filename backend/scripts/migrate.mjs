import { readFile } from "node:fs/promises";
import { Client } from "pg";
import "dotenv/config";

const sqlDirectory = process.env.DATABASE_SQL_DIR
  ? new URL(`file://${process.env.DATABASE_SQL_DIR}/`)
  : new URL("../../database/", import.meta.url);

const schemaPath = new URL("schema.sql", sqlDirectory);
const force = process.argv.includes("--force");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  try {
    const { rows } = await client.query("SELECT to_regclass('public.users') AS table");

    if (rows[0].table && !force) {
      console.log("Schema already present, nothing to do. Re-run with --force to recreate it.");
      return;
    }

    if (force) {
      console.log("Dropping and recreating the public schema");
      await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    }

    await client.query(await readFile(schemaPath, "utf8"));
    console.log("Schema applied");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
