import type { Server, Socket } from "socket.io";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ApiError } from "../../utils/api-error";
import { verifyAccessToken } from "../../utils/jwt";
import type { AuthenticatedUser } from "../auth/auth.types";
import { socketMessageSchema } from "./chat.schemas";
import * as chatService from "./chat.service";
import type { ChatTurn } from "./chat.types";

interface SocketAck {
  (response: { ok: true; turn: ChatTurn } | { ok: false; error: { code: string; message: string } }): void;
}

let ioRef: Server | null = null;

const rateWindows = new Map<string, { count: number; resetAt: number }>();

function roomFor(userId: string): string {
  return `user:${userId}`;
}

function withinRateLimit(userId: string): boolean {
  const now = Date.now();
  const current = rateWindows.get(userId);

  if (!current || current.resetAt <= now) {
    rateWindows.set(userId, { count: 1, resetAt: now + env.RATE_LIMIT_WINDOW_MS });
    return true;
  }

  current.count += 1;
  return current.count <= env.CHAT_RATE_LIMIT_MAX;
}

function toErrorResponse(error: unknown): { code: string; message: string } {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message };
  }
  logger.error({ err: error }, "Unhandled socket error");
  return { code: "internal_error", message: "Something went wrong" };
}

export function emitTurn(userId: string, turn: ChatTurn): void {
  if (!ioRef) return;

  const room = ioRef.to(roomFor(userId));
  room.emit("chat:message", turn.userMessage);
  room.emit("chat:message", turn.assistantMessage);
  room.emit("chat:state", {
    sessionId: turn.sessionId,
    draft: turn.draft,
    missingFields: turn.missingFields,
    needsForm: turn.needsForm,
    assistantSource: turn.assistantSource,
  });

  if (turn.appointment) {
    room.emit("appointment:created", turn.appointment);
  }
}

export function emitAppointmentChanged(userId: string, payload: unknown): void {
  ioRef?.to(roomFor(userId)).emit("appointment:updated", payload);
}

function authenticateSocket(socket: Socket, next: (error?: Error) => void): void {
  const token =
    (socket.handshake.auth?.token as string | undefined) ??
    (typeof socket.handshake.query.token === "string" ? socket.handshake.query.token : undefined);

  if (!token) {
    next(new Error("unauthorized"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user: AuthenticatedUser = {
      id: payload.sub,
      businessId: payload.businessId,
      email: payload.email,
      role: payload.role,
    };
    socket.data.user = user;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
}

export function registerChatGateway(io: Server): void {
  ioRef = io;
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const user = socket.data.user as AuthenticatedUser;
    socket.join(roomFor(user.id));
    logger.debug({ userId: user.id, socketId: socket.id }, "Socket connected");

    socket.on("chat:send", async (payload: unknown, ack?: SocketAck) => {
      const parsed = socketMessageSchema.safeParse(payload);

      if (!parsed.success) {
        ack?.({
          ok: false,
          error: { code: "validation_failed", message: parsed.error.issues[0]?.message ?? "Invalid message" },
        });
        return;
      }

      if (!withinRateLimit(user.id)) {
        ack?.({
          ok: false,
          error: { code: "rate_limited", message: "You are sending messages too quickly" },
        });
        return;
      }

      socket.emit("chat:thinking", true);

      try {
        const turn = await chatService.handleUserMessage(
          user,
          parsed.data.content,
          parsed.data.sessionId,
        );
        emitTurn(user.id, turn);
        ack?.({ ok: true, turn });
      } catch (error) {
        const response = toErrorResponse(error);
        socket.emit("chat:error", response);
        ack?.({ ok: false, error: response });
      } finally {
        socket.emit("chat:thinking", false);
      }
    });

    socket.on("disconnect", (reason) => {
      logger.debug({ userId: user.id, socketId: socket.id, reason }, "Socket disconnected");
    });
  });
}
