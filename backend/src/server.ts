import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app";
import { closePool, verifyConnection } from "./config/database";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { registerChatGateway } from "./modules/chat/chat.gateway";

async function bootstrap(): Promise<void> {
  await verifyConnection();

  const app = createApp();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins.includes("*") ? true : env.corsOrigins,
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  registerChatGateway(io);

  httpServer.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, aiEnabled: env.aiEnabled },
      "API listening",
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down");
    io.close();
    httpServer.close();
    await closePool().catch((error) => logger.error({ err: error }, "Pool shutdown failed"));
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, "Failed to start API");
  process.exit(1);
});
