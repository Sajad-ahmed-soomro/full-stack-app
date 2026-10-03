import { cn } from "@/lib/cn";
import { formatMessageTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === "user";
  const servedByRules = message.metadata?.source === "fallback";

  return (
    <div className={cn("animate-message-in flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[86%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line",
          isUser
            ? "rounded-br-md bg-indigo-600 text-white"
            : "rounded-bl-md bg-white text-slate-700 ring-1 ring-slate-200",
          message.pending && "opacity-70",
          message.failed && "ring-1 ring-rose-300",
        )}
      >
        {message.content}
      </div>
      <div className="flex items-center gap-2 px-1 text-[11px] text-slate-400">
        <span>{isUser ? "You" : "Assistant"}</span>
        <span>{formatMessageTime(message.createdAt)}</span>
        {message.pending && <span>sending</span>}
        {message.failed && <span className="text-rose-500">not sent</span>}
        {servedByRules && <span className="text-slate-400">offline mode</span>}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-3 ring-1 ring-slate-200">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="animate-dot-pulse size-1.5 rounded-full bg-slate-400"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
      <span className="sr-only">The assistant is replying</span>
    </div>
  );
}
