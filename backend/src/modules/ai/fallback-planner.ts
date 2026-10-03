import { resolveRelativeDate, resolveTimeExpression } from "../../utils/datetime";
import { mergeFields, missingFields, sanitiseFields } from "./booking-fields";
import type { AssistantPlan, BookingFieldName, BookingFields, PlanRequest } from "./ai.types";

const BOOKING_ACTION = /\b(book|booked|booking|schedule|reschedule|reserve|rebook|move it|change it)\b/i;
const QUESTION_SHAPE =
  /\?|^\s*(what|when|where|which|who|how|do|does|did|are|is|can|could|would|will|should)\b/i;
const AVAILABILITY_TOPIC = /\b(available|availability|free|slots?|openings?|spaces?)\b/i;
const HOURS_TOPIC = /\b(open|opening|closing|close|hours|weekend|holiday)\b/i;
const PRICE_TOPIC = /\b(cost|costs|price|pricing|charge|charges|fee|fees|how much)\b/i;
const GREETING = /^\s*(hi|hiya|hello|hey|yo|greetings|good\s+(morning|afternoon|evening))\b/i;
const THANKS = /\b(thanks|thank you|cheers|appreciate it)\b/i;

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

type MessageKind =
  | "booking"
  | "availability"
  | "hours"
  | "price"
  | "question"
  | "greeting"
  | "thanks"
  | "other";

export function classifyMessage(message: string): MessageKind {
  if (BOOKING_ACTION.test(message)) return "booking";

  if (QUESTION_SHAPE.test(message)) {
    if (AVAILABILITY_TOPIC.test(message)) return "availability";
    if (HOURS_TOPIC.test(message)) return "hours";
    if (PRICE_TOPIC.test(message)) return "price";
    return "question";
  }

  if (GREETING.test(message)) return "greeting";
  if (THANKS.test(message)) return "thanks";
  return "other";
}

function openingHoursLabel(request: PlanRequest): string {
  const pad = (hour: number) => String(hour).padStart(2, "0");
  return `${pad(request.openingHour)}:00 to ${pad(request.closingHour)}:00 UTC`;
}

function answerWithoutBooking(kind: MessageKind, request: PlanRequest): string {
  const hours = openingHoursLabel(request);

  switch (kind) {
    case "availability":
      return `I cannot list open slots here, but tell me a day and time and I will check whether it is free. We are open ${hours}.`;
    case "hours":
      return `We are open ${hours}, in ${request.slotMinutes}-minute appointments.`;
    case "price":
      return `I do not have pricing to hand, I only arrange appointments. Tell me what you need and when, and I will book it.`;
    case "greeting":
      return `Hello. I book appointments for ${request.businessName}. What do you need, and when suits you?`;
    case "thanks":
      return "You are welcome. Anything else you would like to book?";
    default:
      return `I arrange appointments for ${request.businessName}, open ${hours}. Tell me what you need and when.`;
  }
}

export function buildFallbackPlan(request: PlanRequest, now = new Date()): AssistantPlan {
  const identity = sanitiseFields(
    { customerName: request.defaultName, customerEmail: request.defaultEmail },
    now,
  );
  const carried = mergeFields(identity, request.draft);
  const kind = classifyMessage(request.message);

  if (kind !== "booking" && kind !== "other") {
    return {
      reply: answerWithoutBooking(kind, request),
      intent: kind === "greeting" || kind === "thanks" ? "smalltalk" : "ask_question",
      fields: carried,
      missingFields: missingFields(carried),
      complete: false,
      source: "fallback",
    };
  }

  const extracted = extractFromMessage(request.message, now);
  const addsDetail = Boolean(
    extracted.service ?? extracted.date ?? extracted.time ?? extracted.customerEmail,
  );
  const bookingInProgress = Boolean(carried.service ?? carried.date ?? carried.time);

  if (kind === "other" && !addsDetail && !bookingInProgress) {
    return {
      reply: answerWithoutBooking("other", request),
      intent: "smalltalk",
      fields: carried,
      missingFields: missingFields(carried),
      complete: false,
      source: "fallback",
    };
  }

  const fields = mergeFields(carried, extracted);
  const missing = missingFields(fields);

  return {
    reply: buildReply(fields, missing),
    intent: "book_appointment",
    fields,
    missingFields: missing,
    complete: missing.length === 0,
    source: "fallback",
  };
}
