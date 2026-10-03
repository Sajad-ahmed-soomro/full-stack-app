"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { SendIcon } from "@/components/ui/icons";
import { TextArea } from "@/components/ui/field";

const MAX_LENGTH = 1000;
const COUNTER_THRESHOLD = 800;

interface ComposerProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

export function Composer({ onSend, disabled = false }: ComposerProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    const content = value.trim();
    if (!content || sending || disabled) return;

    setSending(true);
    setValue("");

    try {
      await onSend(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form
      className="border-t border-slate-200 bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-end gap-2">
        <TextArea
          ref={inputRef}
          id="chat-composer"
          rows={2}
          value={value}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          placeholder="Ask for a slot, for example: book a consultation on Friday at 11:00"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Message the booking assistant"
        />
        <Button type="submit" loading={sending} disabled={disabled || value.trim().length === 0}>
          {!sending && <SendIcon className="size-4" />}
          Send
        </Button>
      </div>
      <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-slate-400">
        <span>Enter sends, Shift + Enter adds a line</span>
        {value.length > COUNTER_THRESHOLD && (
          <span>
            {value.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
    </form>
  );
}
