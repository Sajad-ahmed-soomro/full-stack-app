import type {
  Appointment,
  AppointmentStatus,
  AppointmentSummary,
  AuthSession,
  ChatMessage,
  ChatSession,
  ChatTurn,
  CreateAppointmentPayload,
  FieldIssue,
  Profile,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TOKEN_STORAGE_KEY = "schedulr.token";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: FieldIssue[];

  constructor(status: number, code: string, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  fieldMessage(field: string): string | undefined {
    return this.issues.find((issue) => issue.field === field)?.message;
  }
}

let token: string | null = null;

export function setToken(value: string | null): void {
  token = value;
  if (typeof window === "undefined") return;

  if (value) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, value);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getToken(): string | null {
  if (token) return token;
  if (typeof window === "undefined") return null;
  token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  return token;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const authToken = getToken();

  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (authToken) headers.authorization = `Bearer ${authToken}`;

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the API, check that it is running");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: FieldIssue[] } })
      ?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "request_failed",
      error?.message ?? `Request failed with status ${response.status}`,
      Array.isArray(error?.details) ? error.details : [],
    );
  }

  return payload as T;
}

export const api = {
  signup(body: { fullName: string; email: string; password: string; businessName?: string }) {
    return request<AuthSession>("/api/auth/signup", { method: "POST", body });
  },

  login(body: { email: string; password: string }) {
    return request<AuthSession>("/api/auth/login", { method: "POST", body });
  },

  profile(signal?: AbortSignal) {
    return request<Profile>("/api/auth/me", { signal });
  },

  openChatSession() {
    return request<{ session: ChatSession; messages: ChatMessage[] }>("/api/chat/sessions", {
      method: "POST",
    });
  },

  resetChatSession() {
    return request<{ session: ChatSession; messages: ChatMessage[] }>(
      "/api/chat/sessions/reset",
      { method: "POST" },
    );
  },

  chatHistory(sessionId: string, since?: string) {
    const query = since ? `?since=${encodeURIComponent(since)}` : "";
    return request<{ messages: ChatMessage[] }>(
      `/api/chat/sessions/${sessionId}/messages${query}`,
    );
  },

  sendChatMessage(sessionId: string, content: string) {
    return request<ChatTurn>(`/api/chat/sessions/${sessionId}/messages`, {
      method: "POST",
      body: { content },
    });
  },

  appointments(params: { status?: AppointmentStatus; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.limit) query.set("limit", String(params.limit));
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return request<{ appointments: Appointment[]; count: number }>(`/api/appointments${suffix}`);
  },

  appointmentSummary() {
    return request<{ summary: AppointmentSummary }>("/api/appointments/summary");
  },

  createAppointment(body: CreateAppointmentPayload) {
    return request<{ appointment: Appointment }>("/api/appointments", {
      method: "POST",
      body,
    });
  },

  updateAppointment(
    id: string,
    body: { status?: AppointmentStatus; date?: string; time?: string; notes?: string | null },
  ) {
    return request<{ appointment: Appointment }>(`/api/appointments/${id}`, {
      method: "PATCH",
      body,
    });
  },

  cancelAppointment(id: string) {
    return request<{ appointment: Appointment }>(`/api/appointments/${id}`, {
      method: "DELETE",
    });
  },
};
