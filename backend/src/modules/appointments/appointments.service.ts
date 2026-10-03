import { ApiError, isUniqueViolation } from "../../utils/api-error";
import {
  alignsWithSlot,
  combineDateAndTime,
  fitsBusinessHours,
  formatSlotLabel,
  isInFuture,
} from "../../utils/datetime";
import type { AuthenticatedUser } from "../auth/auth.types";
import { getBusinessOrFail } from "../businesses/business.repository";
import type { BusinessRow } from "../businesses/business.types";
import * as repository from "./appointments.repository";
import type {
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from "./appointments.schemas";
import type {
  Appointment,
  AppointmentRow,
  AppointmentSource,
  AppointmentStatus,
  AppointmentSummary,
  BookingDetails,
  SlotEvaluation,
} from "./appointments.types";

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  cancelled: [],
  completed: [],
};

function scopeFor(user: AuthenticatedUser): repository.AppointmentScope {
  return {
    businessId: user.businessId,
    userId: user.role === "customer" ? user.id : undefined,
  };
}

export async function evaluateSlot(
  business: BusinessRow,
  scheduledAt: Date,
  durationMinutes: number,
  excludeAppointmentId?: string,
): Promise<SlotEvaluation> {
  if (!isInFuture(scheduledAt)) {
    return {
      ok: false,
      issue: "in_past",
      message: "That time is in the past, please pick a future slot.",
    };
  }

  if (!fitsBusinessHours(scheduledAt, durationMinutes, business.opening_hour, business.closing_hour)) {
    return {
      ok: false,
      issue: "outside_hours",
      message: `We are open between ${String(business.opening_hour).padStart(2, "0")}:00 and ${String(
        business.closing_hour,
      ).padStart(2, "0")}:00 UTC.`,
    };
  }

  if (!alignsWithSlot(scheduledAt, business.slot_minutes)) {
    return {
      ok: false,
      issue: "misaligned",
      message: `Appointments start every ${business.slot_minutes} minutes from ${String(
        business.opening_hour,
      ).padStart(2, "0")}:00, so pick a slot on that boundary.`,
    };
  }

  const conflict = await repository.findSlotConflict(
    business.id,
    scheduledAt,
    durationMinutes,
    excludeAppointmentId,
  );

  if (conflict) {
    return {
      ok: false,
      issue: "slot_taken",
      message: `${formatSlotLabel(conflict.scheduled_at)} is already booked. Try another time.`,
    };
  }

  return { ok: true };
}

function parseSlot(date: string, time: string): Date {
  const scheduledAt = combineDateAndTime(date, time);
  if (!scheduledAt) {
    throw ApiError.badRequest("Could not read the requested date and time");
  }
  return scheduledAt;
}

async function persist(
  user: AuthenticatedUser,
  business: BusinessRow,
  details: BookingDetails,
  source: AppointmentSource,
  chatSessionId: string | null,
): Promise<AppointmentRow> {
  const scheduledAt = parseSlot(details.date, details.time);
  const evaluation = await evaluateSlot(business, scheduledAt, details.durationMinutes);

  if (!evaluation.ok) {
    if (evaluation.issue === "slot_taken") {
      throw ApiError.conflict(evaluation.message, { issue: evaluation.issue });
    }
    throw ApiError.badRequest(evaluation.message, { issue: evaluation.issue });
  }

  try {
    return await repository.insertAppointment({
      businessId: business.id,
      userId: user.id,
      chatSessionId,
      service: details.service,
      customerName: details.customerName,
      customerEmail: details.customerEmail,
      scheduledAt,
      durationMinutes: details.durationMinutes,
      source,
      notes: details.notes ?? null,
    });
  } catch (error) {
    if (isUniqueViolation(error, "appointments_no_double_booking_idx")) {
      throw ApiError.conflict("That slot was just taken, please choose another time.", {
        issue: "slot_taken",
      });
    }
    throw error;
  }
}

export async function createAppointment(
  user: AuthenticatedUser,
  input: CreateAppointmentInput,
): Promise<Appointment> {
  const business = await getBusinessOrFail(user.businessId);
  const row = await persist(
    user,
    business,
    {
      service: input.service,
      date: input.date,
      time: input.time,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      durationMinutes: input.durationMinutes,
      notes: input.notes ?? null,
    },
    input.chatSessionId ? "chat" : "form",
    input.chatSessionId ?? null,
  );
  return repository.toAppointment(row);
}

export async function createFromConversation(
  user: AuthenticatedUser,
  business: BusinessRow,
  details: BookingDetails,
  chatSessionId: string,
): Promise<Appointment> {
  const row = await persist(user, business, details, "chat", chatSessionId);
  return repository.toAppointment(row);
}

export async function listAppointments(
  user: AuthenticatedUser,
  filters: ListAppointmentsQuery,
): Promise<Appointment[]> {
  const rows = await repository.listAppointments(scopeFor(user), filters);
  return rows.map(repository.toAppointment);
}

export async function getAppointment(
  user: AuthenticatedUser,
  id: string,
): Promise<Appointment> {
  const row = await repository.findAppointmentById(id, scopeFor(user));
  if (!row) {
    throw ApiError.notFound("Appointment not found");
  }
  return repository.toAppointment(row);
}

export async function updateAppointment(
  user: AuthenticatedUser,
  id: string,
  input: UpdateAppointmentInput,
): Promise<Appointment> {
  const scope = scopeFor(user);
  const current = await repository.findAppointmentById(id, scope);

  if (!current) {
    throw ApiError.notFound("Appointment not found");
  }

  if (input.status && input.status !== current.status) {
    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (!allowed.includes(input.status)) {
      throw ApiError.conflict(
        `An appointment that is ${current.status} cannot become ${input.status}`,
      );
    }
  }

  let scheduledAt: Date | undefined;

  if (input.date && input.time) {
    if (current.status === "cancelled" || current.status === "completed") {
      throw ApiError.conflict(`A ${current.status} appointment cannot be rescheduled`);
    }

    scheduledAt = parseSlot(input.date, input.time);
    const business = await getBusinessOrFail(user.businessId);
    const evaluation = await evaluateSlot(
      business,
      scheduledAt,
      input.durationMinutes ?? current.duration_minutes,
      current.id,
    );

    if (!evaluation.ok) {
      if (evaluation.issue === "slot_taken") {
        throw ApiError.conflict(evaluation.message, { issue: evaluation.issue });
      }
      throw ApiError.badRequest(evaluation.message, { issue: evaluation.issue });
    }
  }

  const updated = await repository.updateAppointment(id, scope, {
    status: input.status,
    scheduledAt,
    durationMinutes: input.durationMinutes,
    notes: input.notes,
  });

  if (!updated) {
    throw ApiError.notFound("Appointment not found");
  }

  return repository.toAppointment(updated);
}

export async function cancelAppointment(
  user: AuthenticatedUser,
  id: string,
): Promise<Appointment> {
  return updateAppointment(user, id, { status: "cancelled" });
}

export async function getSummary(user: AuthenticatedUser): Promise<AppointmentSummary> {
  const { counts, upcoming, next } = await repository.summariseAppointments(scopeFor(user));
  return {
    pending: counts.pending ?? 0,
    confirmed: counts.confirmed ?? 0,
    cancelled: counts.cancelled ?? 0,
    completed: counts.completed ?? 0,
    upcoming,
    nextAppointment: next ? repository.toAppointment(next) : null,
  };
}
