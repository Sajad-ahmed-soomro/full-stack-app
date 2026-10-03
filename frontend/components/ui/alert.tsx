import { cn } from "@/lib/cn";

interface AlertProps {
  tone?: "error" | "info" | "success";
  message: string;
  onDismiss?: () => void;
}

const TONE_STYLES = {
  error: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

export function Alert({ tone = "error", message, onDismiss }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-xs ring-1",
        TONE_STYLES[tone],
      )}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 font-medium underline underline-offset-2"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
