"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { api, API_URL, ApiError, getToken } from "./api-client";
import type {
  Appointment,
  BookingDraft,
  BookingFieldName,
  ChatMessage,
  ChatState,
  ChatTurn,
} from "./types";

export type ChatTransport = "connecting" | "live" | "polling" | "offline";

interface State {
  sessionId: string | null;
  messages: ChatMessage[];
  draft: BookingDraft | null;
  missingFields: BookingFieldName[];
  needsForm: boolean;
  assistantSource: "mistral" | "fallback" | null;
  thinking: boolean;
  loading: boolean;
  error: string | null;
  transport: ChatTransport;
}

type Action =
  | { type: "loading" }
  | { type: "session"; sessionId: string; messages: ChatMessage[]; draft: BookingDraft }
  | { type: "messages"; messages: ChatMessage[] }
  | { type: "state"; state: ChatState }
  | { type: "optimistic"; message: ChatMessage }
  | { type: "settled"; tempId: string }
  | { type: "send-failed"; tempId: string; error: string }
  | { type: "thinking"; value: boolean }
  | { type: "transport"; value: ChatTransport }
  | { type: "error"; error: string | null };

const INITIAL_STATE: State = {
  sessionId: null,
  messages: [],
  draft: null,
  missingFields: [],
  needsForm: false,
  assistantSource: null,
  thinking: false,
  loading: true,
  error: null,
  transport: "connecting",
};

function byCreatedAt(a: ChatMessage, b: ChatMessage): number {
  return a.createdAt.localeCompare(b.createdAt);
}

function mergeMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  if (messages.some((message) => message.id === incoming.id)) {
    return messages;
  }

  if (incoming.sender === "user") {
    const pendingIndex = messages.findIndex(
      (message) => message.pending && message.content === incoming.content,
    );

    if (pendingIndex >= 0) {
      const next = [...messages];
      next[pendingIndex] = incoming;
      return next;
    }
  }

  return [...messages, incoming].sort(byCreatedAt);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "loading":
      return { ...state, loading: true, error: null };

    case "session":
      return {
        ...state,
        loading: false,
        error: null,
        sessionId: action.sessionId,
        messages: [...action.messages].sort(byCreatedAt),
        draft: action.draft,
        missingFields: [],
        needsForm: false,
        thinking: false,
      };

    case "messages":
      return {
        ...state,
        messages: action.messages.reduce(mergeMessage, state.messages),
      };

    case "state":
      return {
        ...state,
        sessionId: action.state.sessionId,
        draft: action.state.draft,
        missingFields: action.state.missingFields,
        needsForm: action.state.needsForm,
        assistantSource: action.state.assistantSource,
      };

    case "optimistic":
      return { ...state, messages: [...state.messages, action.message], error: null };

    case "settled":
      return {
        ...state,
        messages: state.messages.filter((message) => message.id !== action.tempId),
      };

    case "send-failed":
      return {
        ...state,
        thinking: false,
        error: action.error,
        messages: state.messages.map((message) =>
          message.id === action.tempId
            ? { ...message, pending: false, failed: true }
            : message,
        ),
      };

    case "thinking":
      return { ...state, thinking: action.value };

    case "transport":
      return { ...state, transport: action.value };

    case "error":
      return { ...state, error: action.error };

    default:
      return state;
  }
}

interface UseChatOptions {
  enabled: boolean;
  onAppointment?: (appointment: Appointment) => void;
}

interface SocketAckResponse {
  ok: boolean;
  turn?: ChatTurn;
  error?: { code: string; message: string };
}

export function useChat({ enabled, onAppointment }: UseChatOptions) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const socketRef = useRef<Socket | null>(null);
  const appointmentHandler = useRef(onAppointment);
  const lastMessageAt = useRef<string | null>(null);

  useEffect(() => {
    appointmentHandler.current = onAppointment;
  }, [onAppointment]);

  useEffect(() => {
    lastMessageAt.current =
      state.messages.filter((message) => !message.pending).at(-1)?.createdAt ?? null;
  }, [state.messages]);

  const loadSession = useCallback(async () => {
    dispatch({ type: "loading" });
    try {
      const { session, messages } = await api.openChatSession();
      dispatch({
        type: "session",
        sessionId: session.id,
        messages,
        draft: session.draft,
      });
    } catch (error) {
      dispatch({
        type: "error",
        error: error instanceof ApiError ? error.message : "Could not load the conversation",
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void loadSession();
  }, [enabled, loadSession]);

  useEffect(() => {
    if (!enabled) return;

    const token = getToken();
    if (!token) return;

    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => dispatch({ type: "transport", value: "live" }));
    socket.on("disconnect", () => dispatch({ type: "transport", value: "polling" }));
    socket.on("connect_error", () => dispatch({ type: "transport", value: "polling" }));
    socket.io.on("reconnect_failed", () => dispatch({ type: "transport", value: "offline" }));

    socket.on("chat:message", (message: ChatMessage) => {
      dispatch({ type: "messages", messages: [message] });
    });
    socket.on("chat:state", (chatState: ChatState) => {
      dispatch({ type: "state", state: chatState });
    });
    socket.on("chat:thinking", (value: boolean) => {
      dispatch({ type: "thinking", value });
    });
    socket.on("appointment:created", (appointment: Appointment) => {
      appointmentHandler.current?.(appointment);
    });
    socket.on("chat:error", (error: { message: string }) => {
      dispatch({ type: "error", error: error.message });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || state.transport === "live" || !state.sessionId) return;

    const sessionId = state.sessionId;
    const interval = setInterval(async () => {
      try {
        const { messages } = await api.chatHistory(sessionId, lastMessageAt.current ?? undefined);
        if (messages.length > 0) {
          dispatch({ type: "messages", messages });
        }
      } catch {
        dispatch({ type: "transport", value: "offline" });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [enabled, state.transport, state.sessionId]);

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !state.sessionId) return;

      const tempId = `pending-${Date.now()}`;
      dispatch({
        type: "optimistic",
        message: {
          id: tempId,
          sessionId: state.sessionId,
          sender: "user",
          content: trimmed,
          createdAt: new Date().toISOString(),
          metadata: null,
          pending: true,
        },
      });

      const socket = socketRef.current;

      try {
        if (socket?.connected) {
          const response = (await socket
            .timeout(25_000)
            .emitWithAck("chat:send", {
              content: trimmed,
              sessionId: state.sessionId,
            })) as SocketAckResponse;

          if (!response.ok) {
            throw new Error(response.error?.message ?? "The assistant could not reply");
          }

          dispatch({ type: "settled", tempId });
          return;
        }

        dispatch({ type: "thinking", value: true });
        const turn = await api.sendChatMessage(state.sessionId, trimmed);
        dispatch({ type: "settled", tempId });
        dispatch({
          type: "messages",
          messages: [turn.userMessage, turn.assistantMessage],
        });
        dispatch({
          type: "state",
          state: {
            sessionId: turn.sessionId,
            draft: turn.draft,
            missingFields: turn.missingFields,
            needsForm: turn.needsForm,
            assistantSource: turn.assistantSource,
          },
        });

        if (turn.appointment) {
          appointmentHandler.current?.(turn.appointment);
        }
      } catch (error) {
        dispatch({
          type: "send-failed",
          tempId,
          error: error instanceof Error ? error.message : "Message could not be sent",
        });
      } finally {
        dispatch({ type: "thinking", value: false });
      }
    },
    [state.sessionId],
  );

  const reset = useCallback(async () => {
    dispatch({ type: "loading" });
    try {
      const { session, messages } = await api.resetChatSession();
      dispatch({ type: "session", sessionId: session.id, messages, draft: session.draft });
    } catch (error) {
      dispatch({
        type: "error",
        error: error instanceof ApiError ? error.message : "Could not start a new conversation",
      });
    }
  }, []);

  const dismissError = useCallback(() => dispatch({ type: "error", error: null }), []);

  return useMemo(
    () => ({ ...state, send, reset, dismissError }),
    [state, send, reset, dismissError],
  );
}
