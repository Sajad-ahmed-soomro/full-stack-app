export const BOOKING_FIELDS = [
  "service",
  "date",
  "time",
  "customerName",
  "customerEmail",
] as const;

export type BookingFieldName = (typeof BOOKING_FIELDS)[number];

export interface BookingFields {
  service: string | null;
  date: string | null;
  time: string | null;
  customerName: string | null;
  customerEmail: string | null;
  notes: string | null;
}

export const EMPTY_BOOKING_FIELDS: BookingFields = {
  service: null,
  date: null,
  time: null,
  customerName: null,
  customerEmail: null,
  notes: null,
};

export type ConversationIntent =
  | "book_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "ask_question"
  | "smalltalk";

export interface AssistantPlan {
  reply: string;
  intent: ConversationIntent;
  fields: BookingFields;
  missingFields: BookingFieldName[];
  complete: boolean;
  source: "mistral" | "fallback";
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface PlanRequest {
  businessName: string;
  openingHour: number;
  closingHour: number;
  slotMinutes: number;
  defaultName: string;
  defaultEmail: string;
  draft: BookingFields;
  history: ConversationTurn[];
  message: string;
}

export interface PlanContext {
  businessId: string;
  sessionId: string;
}
