import { isIsoDate, isTime24h } from "../../utils/datetime";
import {
  BOOKING_FIELDS,
  EMPTY_BOOKING_FIELDS,
  type BookingFieldName,
  type BookingFields,
} from "./ai.types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const MAX_BOOKING_HORIZON_DAYS = 365;

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!cleaned || cleaned.toLowerCase() === "null") return null;
  return cleaned.slice(0, maxLength);
}

function cleanDate(value: unknown, now: Date): string | null {
  const text = cleanText(value, 10);
  if (!text || !isIsoDate(text)) return null;

  const parsed = new Date(`${text}T00:00:00.000Z`);
  const horizon = new Date(now.getTime() + MAX_BOOKING_HORIZON_DAYS * 86_400_000);
  return parsed > horizon ? null : text;
}

function cleanTime(value: unknown): string | null {
  const text = cleanText(value, 5);
  return text && isTime24h(text) ? text : null;
}

function cleanEmail(value: unknown): string | null {
  const text = cleanText(value, 254);
  return text && EMAIL_PATTERN.test(text) ? text.toLowerCase() : null;
}

export function sanitiseFields(input: Partial<BookingFields>, now = new Date()): BookingFields {
  return {
    service: cleanText(input.service, 120),
    date: cleanDate(input.date, now),
    time: cleanTime(input.time),
    customerName: cleanText(input.customerName, 120),
    customerEmail: cleanEmail(input.customerEmail),
    notes: cleanText(input.notes, 500),
  };
}

export function mergeFields(draft: BookingFields, incoming: BookingFields): BookingFields {
  return {
    service: incoming.service ?? draft.service,
    date: incoming.date ?? draft.date,
    time: incoming.time ?? draft.time,
    customerName: incoming.customerName ?? draft.customerName,
    customerEmail: incoming.customerEmail ?? draft.customerEmail,
    notes: incoming.notes ?? draft.notes,
  };
}

export function missingFields(fields: BookingFields): BookingFieldName[] {
  return BOOKING_FIELDS.filter((field) => !fields[field]);
}

export function readDraft(value: unknown, now = new Date()): BookingFields {
  if (!value || typeof value !== "object") return { ...EMPTY_BOOKING_FIELDS };
  return sanitiseFields(value as Partial<BookingFields>, now);
}

export interface CompleteBooking {
  service: string;
  date: string;
  time: string;
  customerName: string;
  customerEmail: string;
  notes: string | null;
}

export function toCompleteBooking(fields: BookingFields): CompleteBooking | null {
  const { service, date, time, customerName, customerEmail } = fields;
  if (!service || !date || !time || !customerName || !customerEmail) return null;
  return { service, date, time, customerName, customerEmail, notes: fields.notes };
}
