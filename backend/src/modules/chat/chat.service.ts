import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { formatSlotLabel } from "../../utils/datetime";
import * as aiService from "../ai/ai.service";
import type { BookingFields, ConversationTurn } from "../ai/ai.types";
import { missingFields, toCompleteBooking, type CompleteBooking } from "../ai/booking-fields";
import * as appointmentService from "../appointments/appointments.service";
import type { Appointment } from "../appointments/appointments.types";
import { findUserById } from "../auth/auth.repository";
import type { AuthenticatedUser } from "../auth/auth.types";
import { getBusinessOrFail } from "../businesses/business.repository";
import type { BusinessRow } from "../businesses/business.types";
import * as repository from "./chat.repository";
import type { MessageHistoryQuery } from "./chat.schemas";
import type { ChatMessage, ChatSession, ChatSessionRow, ChatTurn } from "./chat.types";

const FORM_FALLBACK_AFTER_USER_TURNS = 3;
const FORM_FALLBACK_HINT =
  "If it is easier, open the booking form and I will take the details from there.";

interface Identity {
  fullName: string;
  email: string;
}

async function loadIdentity(user: AuthenticatedUser): Promise<Identity> {
  const profile = await findUserById(user.id);
  if (!profile) {
    throw ApiError.unauthorized("Account no longer exists");
  }
  return { fullName: profile.full_name, email: profile.email };
}

function seedDraft(identity: Identity): BookingFields {
  return {
    service: null,
    date: null,
    time: null,
    customerName: identity.fullName,
    customerEmail: identity.email,
    notes: null,
  };
}

function greetingFor(identity: Identity, business: BusinessRow): string {
  const firstName = identity.fullName.split(" ")[0] ?? "there";
  return `Hi ${firstName}, I book appointments for ${business.name}. Tell me what you need and when, for example "a consultation tomorrow at 2pm". We are open ${String(
    business.opening_hour,
  ).padStart(2, "0")}:00 to ${String(business.closing_hour).padStart(2, "0")}:00 UTC.`;
}

async function getOwnedSession(
  user: AuthenticatedUser,
  sessionId: string,
): Promise<ChatSessionRow> {
  const session = await repository.findSessionById(sessionId, user.id);
  if (!session) {
    throw ApiError.notFound("Chat session not found");
  }
  return session;
}

export async function openSession(
  user: AuthenticatedUser,
): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
  const existing = await repository.findActiveSession(user.id);

  if (existing) {
    const messages = await repository.listMessages(existing.id, { limit: 100 });
    return {
      session: repository.toSession(existing),
      messages: messages.map(repository.toMessage),
    };
  }

  const [identity, business] = await Promise.all([
    loadIdentity(user),
    getBusinessOrFail(user.businessId),
  ]);

  const { session, created } = await repository.createSession(
    user.businessId,
    user.id,
    seedDraft(identity),
  );

  if (!created) {
    const messages = await repository.listMessages(session.id, { limit: 100 });
    return {
      session: repository.toSession(session),
      messages: messages.map(repository.toMessage),
    };
  }

  const greeting = await repository.appendMessage(
    session.id,
    "assistant",
    greetingFor(identity, business),
    { kind: "greeting" },
  );

  return {
    session: repository.toSession(session),
    messages: [repository.toMessage(greeting)],
  };
}

export async function listSessions(user: AuthenticatedUser): Promise<ChatSession[]> {
  const rows = await repository.listSessions(user.id);
  return rows.map(repository.toSession);
}

export async function getMessages(
  user: AuthenticatedUser,
  sessionId: string,
  options: MessageHistoryQuery,
): Promise<ChatMessage[]> {
  await getOwnedSession(user, sessionId);
  const rows = await repository.listMessages(sessionId, options);
  return rows.map(repository.toMessage);
}

export async function closeSession(
  user: AuthenticatedUser,
): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
  const active = await repository.findActiveSession(user.id);
  if (active) {
    await repository.closeSession(active.id, user.id);
  }
  return openSession(user);
}

function toConversationTurns(messages: ChatMessage[]): ConversationTurn[] {
  return messages
    .filter((message) => message.sender === "user" || message.sender === "assistant")
    .map((message) => ({
      role: message.sender === "user" ? "user" : "assistant",
      content: message.content,
    }));
}

export async function handleUserMessage(
  user: AuthenticatedUser,
  content: string,
  sessionId?: string,
): Promise<ChatTurn> {
  const session = sessionId
    ? await getOwnedSession(user, sessionId)
    : (
        await repository.createSession(
          user.businessId,
          user.id,
          seedDraft(await loadIdentity(user)),
        )
      ).session;

  if (session.status === "closed") {
    throw ApiError.conflict("This conversation is closed, start a new one");
  }

  const [identity, business, historyRows] = await Promise.all([
    loadIdentity(user),
    getBusinessOrFail(user.businessId),
    repository.listRecentTurns(session.id, env.AI_HISTORY_TURNS),
  ]);

  const storedDraft = repository.toSession(session).draft;
  const userMessage = await repository.appendMessage(session.id, "user", content);

  const plan = await aiService.buildAssistantPlan(
    {
      businessName: business.name,
      openingHour: business.opening_hour,
      closingHour: business.closing_hour,
      slotMinutes: business.slot_minutes,
      defaultName: identity.fullName,
      defaultEmail: identity.email,
      draft: storedDraft,
      history: toConversationTurns(historyRows.map(repository.toMessage)),
      message: content,
    },
    { businessId: user.businessId, sessionId: session.id },
  );

  let reply = plan.reply;
  let appointment: Appointment | null = null;
  let nextDraft = plan.fields;

  const completeBooking = toCompleteBooking(plan.fields);

  if (plan.intent === "book_appointment" && completeBooking) {
    const booking = await bookFromDraft(user, business, completeBooking, session.id);
    appointment = booking.appointment;
    reply = booking.reply;
    nextDraft = appointment
      ? seedDraft(identity)
      : { ...plan.fields, date: null, time: null };
  }

  const resolvedFields = appointment ? plan.fields : nextDraft;
  const remaining = appointment ? [] : missingFields(nextDraft);
  const userTurns = await repository.countUserMessages(session.id);
  const needsForm =
    appointment === null &&
    remaining.length > 0 &&
    userTurns >= FORM_FALLBACK_AFTER_USER_TURNS &&
    plan.intent === "book_appointment";

  if (needsForm) {
    reply = `${reply} ${FORM_FALLBACK_HINT}`;
  }

  const assistantMessage = await repository.appendMessage(session.id, "assistant", reply, {
    intent: plan.intent,
    source: plan.source,
    fields: resolvedFields,
    missingFields: remaining,
    needsForm,
    appointmentId: appointment?.id ?? null,
  });

  await repository.updateDraft(session.id, nextDraft);

  return {
    sessionId: session.id,
    userMessage: repository.toMessage(userMessage),
    assistantMessage: repository.toMessage(assistantMessage),
    draft: nextDraft,
    missingFields: remaining,
    needsForm,
    appointment,
    assistantSource: plan.source,
  };
}

async function bookFromDraft(
  user: AuthenticatedUser,
  business: BusinessRow,
  booking: CompleteBooking,
  sessionId: string,
): Promise<{ appointment: Appointment | null; reply: string }> {
  try {
    const appointment = await appointmentService.createFromConversation(
      user,
      business,
      { ...booking, durationMinutes: business.slot_minutes },
      sessionId,
    );

    return {
      appointment,
      reply: `Booked ${appointment.service} for ${formatSlotLabel(
        new Date(appointment.scheduledAt),
      )} UTC. A confirmation goes to ${appointment.customerEmail}.`,
    };
  } catch (error) {
    if (error instanceof ApiError && error.statusCode < 500) {
      return { appointment: null, reply: `${error.message} What should I try instead?` };
    }
    throw error;
  }
}
