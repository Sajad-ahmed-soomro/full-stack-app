import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { chatRateLimiter } from "../../middleware/rate-limit";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import * as controller from "./chat.controller";
import {
  messageHistorySchema,
  sendMessageSchema,
  sessionIdSchema,
} from "./chat.schemas";

export const chatRouter = Router();

chatRouter.use(authenticate);

chatRouter.get("/sessions", asyncHandler(controller.listSessions));
chatRouter.post("/sessions", asyncHandler(controller.openSession));
chatRouter.post("/sessions/reset", asyncHandler(controller.resetSession));

chatRouter.get(
  "/sessions/:id/messages",
  validate({ params: sessionIdSchema, query: messageHistorySchema }),
  asyncHandler(controller.messages),
);

chatRouter.post(
  "/sessions/:id/messages",
  chatRateLimiter,
  validate({ params: sessionIdSchema, body: sendMessageSchema }),
  asyncHandler(controller.sendMessage),
);
