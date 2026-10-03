import { resolveRelativeDate, resolveTimeExpression } from "../../utils/datetime";
import { mergeFields, missingFields, sanitiseFields } from "./booking-fields";
import type { AssistantPlan, BookingFieldName, BookingFields, PlanRequest } from "./ai.types";

const BOOKING_SIGNALS =
  /\b(book|booking|appointment|schedule|reschedule|slot|availability|available|reserve|meet)\b/i;

const SERVICE_KEYWORDS = [
  "consultation",
  "checkup",
  "check-up",
  "cleaning",
  "haircut",
  "massage",
  "demo",
  "follow-up",
  "assessment",
  "repair",
  "fitting",
  "review",
  "training",
];

const FIELD_PROMPTS: Record<BookingFieldName, string> = {
  service: "what you would like to book",
  date: "which date suits you",
  time: "what time works",
  customerName: "the name for the booking",
  customerEmail: "an email for the confirmation",
};

const FILLER_WORDS = new Set([
  "the",
  "and",
  "for",
  "please",
  "book",
  "booking",
  "appointment",
  "appointments",
  "slot",
  "session",
  "schedule",
  "rescheduled",
  "reschedule",
  "want",
  "need",
  "like",
  "would",
  "could",
  "can",
  "you",
  "get",
  "some",
  "new",
  "next",
  "today",
  "tomorrow",
  "morning",
  "afternoon",
  "evening",
  "this",
  "that",
  "with",
  "about",
]);

const EMAIL_IN_TEXT = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const NAME_IN_TEXT = /\b(?:my name is|i am|i'm|this is|name:)\s+([a-z][a-z' -]{1,48})/i;

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractService(message: string): string | null {
  const lower = message.toLowerCase();

  const keyword = SERVICE_KEYWORDS.find((entry) => lower.includes(entry));
  if (keyword) return titleCase(keyword);

  const phrase = lower.match(/\b(?:book|schedule|need|want|arrange|looking for)\b(.{0,48})/);
  if (!phrase?.[1]) return null;

  const words = phrase[1]
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !FILLER_WORDS.has(word));

  const candidate = words.slice(0, 3).join(" ");
  return candidate.length >= 3 ? titleCase(candidate) : null;
}

function extractFromMessage(message: string, now: Date): BookingFields {
  const nameMatch = message.match(NAME_IN_TEXT);

  return sanitiseFields(
    {
      service: extractService(message),
      date: resolveRelativeDate(message, now),
      time: resolveTimeExpression(message),
      customerName: nameMatch?.[1] ? titleCase(nameMatch[1].trim()) : null,
      customerEmail: message.match(EMAIL_IN_TEXT)?.[0] ?? null,
      notes: null,
    },
    now,
  );
}

function buildReply(fields: BookingFields, missing: BookingFieldName[]): string {
  if (missing.length === 0) {
    return `Thanks, I have everything I need for your ${fields.service} booking. Confirming it now.`;
  }

  const asks = missing.slice(0, 2).map((field) => FIELD_PROMPTS[field]);
  const question = asks.length === 1 ? asks[0] : `${asks[0]} and ${asks[1]}`;
  const captured = [fields.service, fields.date, fields.time].filter(Boolean);

  const acknowledgement = captured.length > 0
    ? `Noted: ${captured.join(" at ")}.`
    : "I can get that booked for you.";

  return `${acknowledgement} Could you tell me ${question}?`;
}

export function buildFallbackPlan(request: PlanRequest, now = new Date()): AssistantPlan {
  const extracted = extractFromMessage(request.message, now);
  const identity = sanitiseFields(
    { customerName: request.defaultName, customerEmail: request.defaultEmail },
    now,
  );

  const fields = mergeFields(
    mergeFields(identity, request.draft),
    extracted,
  );

  const missing = missingFields(fields);
  const looksLikeBooking =
    BOOKING_SIGNALS.test(request.message) ||
    Boolean(extracted.date ?? extracted.time ?? extracted.service) ||
    request.draft.service !== null;

  if (!looksLikeBooking) {
    return {
      reply:
        "I can help you book an appointment. Tell me what you need and a date and time that suit you.",
      intent: "smalltalk",
      fields,
      missingFields: missing,
      complete: false,
      source: "fallback",
    };
  }

  return {
    reply: buildReply(fields, missing),
    intent: "book_appointment",
    fields,
    missingFields: missing,
    complete: missing.length === 0,
    source: "fallback",
  };
}
