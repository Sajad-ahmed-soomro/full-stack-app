export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export interface PublicBusiness {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  openingHour: number;
  closingHour: number;
  slotMinutes: number;
}

export interface AuthSession {
  token: string;
  expiresIn: string;
  user: PublicUser;
  business: PublicBusiness;
}

export interface Profile {
  user: PublicUser;
  business: PublicBusiness;
}

export type BookingFieldName =
  | "service"
  | "date"
  | "time"
  | "customerName"
  | "customerEmail";

export interface BookingDraft {
  service: string | null;
  date: string | null;
  time: string | null;
  customerName: string | null;
  customerEmail: string | null;
  notes: string | null;
}

export type MessageSender = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: MessageSender;
  content: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  pending?: boolean;
  failed?: boolean;
}

export interface ChatSession {
  id: string;
  status: "active" | "closed";
  title: string | null;
  draft: BookingDraft;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface Appointment {
  id: string;
  service: string;
  customerName: string;
  customerEmail: string;
  scheduledAt: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: AppointmentStatus;
  source: "chat" | "form";
  notes: string | null;
  chatSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentSummary {
  pending: number;
  confirmed: number;
  cancelled: number;
  completed: number;
  upcoming: number;
  nextAppointment: Appointment | null;
}

export interface ChatTurn {
  sessionId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  draft: BookingDraft;
  missingFields: BookingFieldName[];
  needsForm: boolean;
  appointment: Appointment | null;
  assistantSource: "mistral" | "fallback";
}

export interface ChatState {
  sessionId: string;
  draft: BookingDraft;
  missingFields: BookingFieldName[];
  needsForm: boolean;
  assistantSource: "mistral" | "fallback";
}

export interface FieldIssue {
  location: string;
  field: string;
  message: string;
}

export interface CreateAppointmentPayload {
  service: string;
  date: string;
  time: string;
  customerName: string;
  customerEmail: string;
  durationMinutes?: number;
  notes?: string;
  chatSessionId?: string;
}
