"use client";

import { useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshIcon, SparkIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { ChatTransport } from "@/lib/use-chat";
import type { ChatMessage } from "@/lib/types";
import { Composer } from "./composer";
import { MessageBubble, TypingIndicator } from "./message-bubble";

const SUGGESTIONS = [
  "Book a consultation tomorrow at 14:00",
  "I need a cleaning on Friday morning",
  "What do you need from me to book?",
];

const TRANSPORT_LABELS: Record<ChatTransport, { label: string; dot: string }> = {
  connecting: { label: "Connecting", dot: "bg-slate-300" },
  live: { label: "Live", dot: "bg-emerald-500" },
  polling: { label: "Polling", dot: "bg-amber-500" },
  offline: { label: "Offline", dot: "bg-rose-500" },
};

interface ChatPanelProps {
  messages: ChatMessage[];
  thinking: boolean;
  loading: boolean;
  error: string | null;
  transport: ChatTransport;
  onSend: (content: string) => Promise<void>;
  onReset: () => Promise<void>;
  onDismissError: () => void;
}

export function ChatPanel({
  messages,
  thinking,
  loading,
  error,
  transport,
  onSend,
  onReset,
  onDismissError,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const transportMeta = TRANSPORT_LABELS[transport];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, thinking]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <SparkIcon className="size-5" />
          </span>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">Booking assistant</h1>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={cn("size-1.5 rounded-full", transportMeta.dot)} />
              {transportMeta.label}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void onReset()}>
          <RefreshIcon className="size-4" />
          New chat
        </Button>
      </header>

      <div className="scroll-area flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((index) => (
              <div key={index} className="h-14 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}

        {thinking && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && !loading && (
        <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-white px-4 pt-3">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void onSend(suggestion)}
              className="rounded-full bg-slate-50 px-3 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="border-t border-slate-200 bg-white px-4 pt-3">
          <Alert message={error} onDismiss={onDismissError} />
        </div>
      )}

      <Composer onSend={onSend} disabled={loading} />
    </section>
  );
}
