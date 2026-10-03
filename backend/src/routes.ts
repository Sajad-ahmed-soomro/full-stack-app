import { Router } from "express";
import { env } from "./config/env";
import { appointmentsRouter } from "./modules/appointments/appointments.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { chatRouter } from "./modules/chat/chat.routes";

export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.json({
    name: "schedulr-api",
    aiProvider: env.aiEnabled ? "mistral" : "rule-based-fallback",
    endpoints: {
      auth: ["POST /api/auth/signup", "POST /api/auth/login", "GET /api/auth/me"],
      chat: [
        "GET /api/chat/sessions",
        "POST /api/chat/sessions",
        "POST /api/chat/sessions/reset",
        "GET /api/chat/sessions/:id/messages",
        "POST /api/chat/sessions/:id/messages",
      ],
      appointments: [
        "GET /api/appointments",
        "GET /api/appointments/summary",
        "POST /api/appointments",
        "GET /api/appointments/:id",
        "PATCH /api/appointments/:id",
        "DELETE /api/appointments/:id",
      ],
      realtime: ["socket.io: chat:send, chat:message, chat:state, chat:thinking, appointment:created"],
    },
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/appointments", appointmentsRouter);
