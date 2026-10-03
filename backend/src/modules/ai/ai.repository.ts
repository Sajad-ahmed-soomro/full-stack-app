import { query } from "../../config/database";
import { logger } from "../../config/logger";

export type AiCallStatus = "success" | "parse_error" | "provider_error";

export interface InteractionLog {
  businessId: string;
  sessionId: string;
  provider: string;
  model: string;
  status: AiCallStatus;
  requestPayload: unknown;
  responsePayload?: unknown;
  errorMessage?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  latencyMs: number;
}

export async function recordInteraction(entry: InteractionLog): Promise<void> {
  logger.info(
    {
      sessionId: entry.sessionId,
      provider: entry.provider,
      model: entry.model,
      status: entry.status,
      latencyMs: entry.latencyMs,
      promptTokens: entry.promptTokens,
      completionTokens: entry.completionTokens,
    },
    "AI interaction",
  );

  try {
    await query(
      `INSERT INTO ai_interactions (business_id, session_id, provider, model, status,
                                    request_payload, response_payload, error_message,
                                    prompt_tokens, completion_tokens, latency_ms)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entry.businessId,
        entry.sessionId,
        entry.provider,
        entry.model,
        entry.status,
        JSON.stringify(entry.requestPayload),
        entry.responsePayload === undefined ? null : JSON.stringify(entry.responsePayload),
        entry.errorMessage ?? null,
        entry.promptTokens ?? null,
        entry.completionTokens ?? null,
        Math.round(entry.latencyMs),
      ],
    );
  } catch (error) {
    logger.error({ err: error, sessionId: entry.sessionId }, "Failed to persist AI interaction");
  }
}
