export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type AppointmentSource = "chat" | "form";

export interface AppointmentRow {
  id: string;
  business_id: string;
  user_id: string;
  chat_session_id: string | null;
  service: string;
  customer_name: string;
  customer_email: string;
  scheduled_at: Date;
  duration_minutes: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

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
  source: AppointmentSource;
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

export interface BookingDetails {
  service: string;
  date: string;
  time: string;
  customerName: string;
  customerEmail: string;
  durationMinutes: number;
  notes?: string | null;
}

export type SlotIssue = "in_past" | "outside_hours" | "misaligned" | "slot_taken";

export type SlotEvaluation =
  | { ok: true }
  | { ok: false; issue: SlotIssue; message: string };
