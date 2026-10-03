import { cn } from "@/lib/cn";
import type { AppointmentStatus } from "@/lib/types";

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-200",
  completed: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1",
        STATUS_STYLES[status],
      )}
    >
      {status}
    </span>
  );
}

export function Tag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "info" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
        tone === "info"
          ? "bg-sky-50 text-sky-700 ring-sky-200"
          : "bg-slate-50 text-slate-600 ring-slate-200",
      )}
    >
      {children}
    </span>
  );
}
