import { toIsoDate } from "../../utils/datetime";
import type { ProviderMessage } from "./mistral.client";
import type { PlanRequest } from "./ai.types";

const RESPONSE_CONTRACT = `Reply with a single JSON object and nothing else:
{
  "reply": string,
  "intent": "book_appointment" | "reschedule_appointment" | "cancel_appointment" | "ask_question" | "smalltalk",
  "fields": {
    "service": string | null,
    "date": string | null,
    "time": string | null,
    "customerName": string | null,
    "customerEmail": string | null,
    "notes": string | null
  }
}`;

const RULES = [
  "Carry forward every value already captured in the draft unless the customer changes it.",
  "Set a field to null when the customer has not provided it; never guess a value.",
  "date must be YYYY-MM-DD and time must be 24-hour HH:MM, both resolved against today's date.",
  "Resolve relative dates such as tomorrow or next Tuesday into a concrete date.",
  "Ask for at most two missing details per reply and keep the reply under three sentences.",
  "Stay on the subject of booking, rescheduling or cancelling appointments for this business.",
  "Never promise a booking is confirmed; the system confirms it after validation.",
];

export function buildSystemPrompt(request: PlanRequest, now = new Date()): string {
  return [
    `You are the booking assistant for ${request.businessName}.`,
    `Today is ${toIsoDate(now)} and all times are UTC.`,
    `Opening hours are ${String(request.openingHour).padStart(2, "0")}:00 to ${String(
      request.closingHour,
    ).padStart(2, "0")}:00, with appointments starting every ${request.slotMinutes} minutes.`,
    `The signed-in customer is ${request.defaultName} (${request.defaultEmail}); use those values for customerName and customerEmail unless the customer names someone else.`,
    `You collect five details: service, date, time, customerName, customerEmail.`,
    "",
    `Draft collected so far: ${JSON.stringify(request.draft)}`,
    "",
    RESPONSE_CONTRACT,
    "",
    `Rules:\n${RULES.map((rule) => `- ${rule}`).join("\n")}`,
  ].join("\n");
}

export function buildMessages(request: PlanRequest, now = new Date()): ProviderMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(request, now) },
    ...request.history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: request.message },
  ];
}
