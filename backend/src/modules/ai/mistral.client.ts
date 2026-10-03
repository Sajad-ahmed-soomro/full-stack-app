import { env } from "../../config/env";

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderCompletion {
  content: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
}

export class ProviderError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number; retryable: boolean }) {
    super(message);
    this.name = "ProviderError";
    this.status = options.status;
    this.retryable = options.retryable;
  }
}

interface MistralResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestCompletion(messages: ProviderMessage[]): Promise<ProviderCompletion> {
  let response: Response;

  try {
    response = await fetch(`${env.MISTRAL_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.MISTRAL_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network failure";
    throw new ProviderError(`Mistral request failed: ${reason}`, { retryable: true });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ProviderError(
      `Mistral responded with ${response.status}: ${body.slice(0, 200)}`,
      { status: response.status, retryable: RETRYABLE_STATUS.has(response.status) },
    );
  }

  const payload = (await response.json().catch(() => null)) as MistralResponse | null;
  const content = payload?.choices?.[0]?.message?.content;

  if (!content) {
    throw new ProviderError("Mistral returned an empty completion", { retryable: true });
  }

  return {
    content,
    model: payload?.model ?? env.MISTRAL_MODEL,
    promptTokens: payload?.usage?.prompt_tokens ?? null,
    completionTokens: payload?.usage?.completion_tokens ?? null,
  };
}

export async function createChatCompletion(
  messages: ProviderMessage[],
): Promise<ProviderCompletion> {
  let lastError: ProviderError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestCompletion(messages);
    } catch (error) {
      lastError = error instanceof ProviderError
        ? error
        : new ProviderError("Unexpected provider failure", { retryable: false });

      if (!lastError.retryable || attempt === MAX_ATTEMPTS) break;
      await delay(RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError ?? new ProviderError("Mistral request failed", { retryable: false });
}
