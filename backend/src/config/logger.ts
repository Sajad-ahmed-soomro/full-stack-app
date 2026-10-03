import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "schedulr-api" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "*.password",
      "passwordHash",
      "*.passwordHash",
      "apiKey",
      "*.apiKey",
    ],
    censor: "[redacted]",
  },
  transport: env.isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname,service" },
      },
});

export type Logger = typeof logger;
