import { z } from "zod";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { buildMessages } from "./ai.prompt";
import { recordInteraction } from "./ai.repository";
import type { AssistantPlan, PlanContext, PlanRequest } from "./ai.types";
import { mergeFields, missingFields, sanitiseFields } from "./booking-fields";
import { buildFallbackPlan } from "./fallback-planner";
import { createChatCompletion, ProviderError } from "./mistral.client";

const MAX_REPLY_LENGTH = 600;

const providerPlanSchema = z.object({
  reply: z.string().trim().min(1),
  intent: z
    .enum([
      "book_appointment",
      "reschedule_appointment",
      "cancel_appointment",
      "ask_question",
      "smalltalk",
    ])
    .catch("book_appointment"),
  fields: z
    .object({
      service: z.unknown().optional(),
      date: z.unknown().optional(),
      time: z.unknown().optional(),
      customerName: z.unknown().optional(),
      customerEmail: z.unknown().optional(),
      notes: z.unknown().optional(),
    })
    .default({}),
});

function parsePlan(raw: string, request: PlanRequest, now: Date): AssistantPlan {
  const json: unknown = JSON.parse(raw);
  const parsed = providerPlanSchema.parse(json);

  const fields = mergeFields(
    request.draft,
    sanitiseFields(parsed.fields as Record<string, unknown>, now),
  );
  const missing = missingFields(fields);

  return {
    reply: parsed.reply.slice(0, MAX_REPLY_LENGTH),
    intent: parsed.intent,
    fields,
    missingFields: missing,
    complete: missing.length === 0,
    source: "mistral",
  };
}

export async function buildAssistantPlan(
  request: PlanRequest,
  context: PlanContext,
  now = new Date(),
): Promise<AssistantPlan> {
  if (!env.aiEnabled) {
    const startedAt = Date.now();
    const plan = buildFallbackPlan(request, now);
    await recordInteraction({
      businessId: context.businessId,
      sessionId: context.sessionId,
      provider: "fallback",
      model: "rule-based",
      status: "success",
      requestPayload: { message: request.message, draft: request.draft },
      responsePayload: { reply: plan.reply, fields: plan.fields, reason: "provider_not_configured" },
      latencyMs: Date.now() - startedAt,
    });
    return plan;
  }

  const messages = buildMessages(request, now);
  const requestPayload = {
    model: env.MISTRAL_MODEL,
    turns: messages.length,
    message: request.message,
    draft: request.draft,
  };
  const startedAt = Date.now();

  try {
    const completion = await createChatCompletion(messages);
    const latencyMs = Date.now() - startedAt;

    try {
      const plan = parsePlan(completion.content, request, now);
      await recordInteraction({
        businessId: context.businessId,
        sessionId: context.sessionId,
        provider: "mistral",
        model: completion.model,
        status: "success",
        requestPayload,
        responsePayload: {
          reply: plan.reply,
          intent: plan.intent,
          fields: plan.fields,
          missingFields: plan.missingFields,
        },
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        latencyMs,
      });
      return plan;
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : "unknown parse failure";
      logger.warn({ sessionId: context.sessionId, err: parseError }, "AI response rejected");
      await recordInteraction({
        businessId: context.businessId,
        sessionId: context.sessionId,
        provider: "mistral",
        model: completion.model,
        status: "parse_error",
        requestPayload,
        responsePayload: { raw: completion.content.slice(0, 1000) },
        errorMessage: message,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        latencyMs,
      });
      return buildFallbackPlan(request, now);
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : "unknown provider failure";
    logger.error({ sessionId: context.sessionId, err: error }, "AI provider unavailable");

    await recordInteraction({
      businessId: context.businessId,
      sessionId: context.sessionId,
      provider: "mistral",
      model: env.MISTRAL_MODEL,
      status: "provider_error",
      requestPayload,
      errorMessage: message,
      latencyMs,
    });

    const plan = buildFallbackPlan(request, now);
    const degradedNotice =
      error instanceof ProviderError && error.status === 429
        ? "The assistant is busy right now, so I am handling this directly."
        : "I am having trouble reaching the assistant, so I will keep this simple.";

    return { ...plan, reply: `${degradedNotice} ${plan.reply}` };
  }
}
