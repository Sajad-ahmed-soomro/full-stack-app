import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: booleanFromString.default("false"),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),

  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  CHAT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  MISTRAL_API_KEY: optionalSecret,
  MISTRAL_BASE_URL: z.string().url().default("https://api.mistral.ai/v1"),
  MISTRAL_MODEL: z.string().default("mistral-small-latest"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  AI_HISTORY_TURNS: z.coerce.number().int().positive().max(40).default(12),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === "production",
  aiEnabled: Boolean(parsed.data.MISTRAL_API_KEY),
};

export type Env = typeof env;
