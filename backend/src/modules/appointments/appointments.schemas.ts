import { z } from "zod";
import { ISO_DATE_PATTERN, TIME_24H_PATTERN } from "../../utils/datetime";
import { APPOINTMENT_STATUSES } from "./appointments.types";

export const dateField = z
  .string()
  .regex(ISO_DATE_PATTERN, "Use the format YYYY-MM-DD");

export const timeField = z
  .string()
  .regex(TIME_24H_PATTERN, "Use a 24-hour time such as 14:30");

export const createAppointmentSchema = z.object({
  service: z.string().trim().min(2).max(120),
  date: dateField,
  time: timeField,
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(254)
    .transform((value) => value.toLowerCase()),
  durationMinutes: z.coerce.number().int().min(15).max(480).default(30),
  notes: z.string().trim().max(2000).optional(),
  chatSessionId: z.string().uuid().optional(),
});

export const updateAppointmentSchema = z
  .object({
    status: z.enum(APPOINTMENT_STATUSES).optional(),
    date: dateField.optional(),
    time: timeField.optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    durationMinutes: z.coerce.number().int().min(15).max(480).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  })
  .refine((value) => (value.date ? Boolean(value.time) : true), {
    message: "Rescheduling requires both date and time",
    path: ["time"],
  })
  .refine((value) => (value.time ? Boolean(value.date) : true), {
    message: "Rescheduling requires both date and time",
    path: ["date"],
  });

export const listAppointmentsSchema = z.object({
  status: z
    .union([z.enum(APPOINTMENT_STATUSES), z.array(z.enum(APPOINTMENT_STATUSES))])
    .optional()
    .transform((value) => (value === undefined ? undefined : [value].flat())),
  from: dateField.optional(),
  to: dateField.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const appointmentIdSchema = z.object({
  id: z.string().uuid("Appointment id must be a UUID"),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsSchema>;
