import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { verifyConnection } from "./config/database";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { globalRateLimiter } from "./middleware/rate-limit";
import { requestLogger } from "./middleware/request-logger";
import { apiRouter } from "./routes";
import { asyncHandler } from "./utils/async-handler";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins.includes("*") ? true : env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "64kb" }));
  app.use(requestLogger);
  app.use(globalRateLimiter);

  app.get(
    "/health",
    asyncHandler(async (_req, res) => {
      const checks = { database: "ok" as "ok" | "unreachable" };

      try {
        await verifyConnection();
      } catch {
        checks.database = "unreachable";
      }

      const healthy = checks.database === "ok";
      res.status(healthy ? 200 : 503).json({
        status: healthy ? "ok" : "degraded",
        uptimeSeconds: Math.round(process.uptime()),
        aiProvider: env.aiEnabled ? "mistral" : "rule-based-fallback",
        checks,
      });
    }),
  );

  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
