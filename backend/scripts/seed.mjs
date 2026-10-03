import { readFile } from "node:fs/promises";
import { Client } from "pg";
import "dotenv/config";

const sqlDirectory = process.env.DATABASE_SQL_DIR
  ? new URL(`file://${process.env.DATABASE_SQL_DIR}/`)
  : new URL("../../database/", import.meta.url);

const seedPath = new URL("seed.sql", sqlDirectory);

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
    await client.query(await readFile(seedPath, "utf8"));
    console.log("Seed data inserted");
    console.log("Sign in with demo@schedulr.test / Password123!");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
