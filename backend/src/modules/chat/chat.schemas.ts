import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(1000, "Message is too long, keep it under 1000 characters"),
});

export const sessionIdSchema = z.object({
  id: z.string().uuid("Session id must be a UUID"),
});

export const messageHistorySchema = z.object({
  since: z
    .string()
    .datetime({ message: "since must be an ISO timestamp" })
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const socketMessageSchema = sendMessageSchema.extend({
  sessionId: z.string().uuid().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageHistoryQuery = z.infer<typeof messageHistorySchema>;
export type SocketMessageInput = z.infer<typeof socketMessageSchema>;
