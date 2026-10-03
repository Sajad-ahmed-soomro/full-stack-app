import type { Appointment } from "../appointments/appointments.types";
import type { BookingFieldName, BookingFields } from "../ai/ai.types";

export type MessageSender = "user" | "assistant" | "system";

export interface ChatSessionRow {
  id: string;
  business_id: string;
  user_id: string;
  status: "active" | "closed";
  title: string | null;
  draft: unknown;
  message_count: number;
  last_message_at: Date | null;
  created_at: Date;
  closed_at: Date | null;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  sender: MessageSender;
  content: string;
  extracted_data: unknown;
  created_at: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: MessageSender;
  content: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface ChatSession {
  id: string;
  status: "active" | "closed";
  title: string | null;
  draft: BookingFields;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ChatTurn {
  sessionId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  draft: BookingFields;
  missingFields: BookingFieldName[];
  needsForm: boolean;
  appointment: Appointment | null;
  assistantSource: "mistral" | "fallback";
}
