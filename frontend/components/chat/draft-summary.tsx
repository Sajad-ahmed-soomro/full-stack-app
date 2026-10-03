import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { CheckIcon } from "@/components/ui/icons";
import type { BookingDraft, BookingFieldName } from "@/lib/types";

const FIELDS: Array<{ key: BookingFieldName; label: string }> = [
  { key: "service", label: "Service" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "customerName", label: "Name" },
  { key: "customerEmail", label: "Email" },
];

function displayValue(key: BookingFieldName, draft: BookingDraft): string | null {
  const value = draft[key];
  if (!value) return null;
  return key === "date" ? formatDate(value) : value;
}

export function DraftSummary({ draft }: { draft: BookingDraft }) {
  const captured = FIELDS.filter((field) => Boolean(draft[field.key])).length;

  return (
    <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Details captured</h2>
        <span className="text-xs text-slate-500">
          {captured} of {FIELDS.length}
        </span>
      </header>
      <dl className="space-y-2">
        {FIELDS.map((field) => {
          const value = displayValue(field.key, draft);
          return (
            <div key={field.key} className="flex items-center justify-between gap-3 text-sm">
              <dt className="flex items-center gap-2 text-slate-500">
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full",
                    value ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-300",
                  )}
                >
                  {value ? <CheckIcon className="size-3" /> : null}
                </span>
                {field.label}
              </dt>
              <dd className={cn("truncate text-right", value ? "text-slate-900" : "text-slate-400")}>
                {value ?? "Not set"}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
