import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "./env";
import { logger } from "./logger";

const SLOW_QUERY_MS = 300;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (error) => {
  logger.error({ err: error }, "Unexpected error on idle database client");
});

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const startedAt = process.hrtime.bigint();
  try {
    const result = await pool.query<T>(text, params);
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    if (durationMs > SLOW_QUERY_MS) {
      logger.warn({ durationMs: Math.round(durationMs), text }, "Slow query");
    }
    return result.rows;
  } catch (error) {
    logger.error({ err: error, text }, "Query failed");
    throw error;
  }
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  handler: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyConnection(): Promise<void> {
  await query("SELECT 1");
}

export async function closePool(): Promise<void> {
  await pool.end();
}
