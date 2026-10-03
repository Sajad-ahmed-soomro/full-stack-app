import { formatSlot, relativeDay } from "@/lib/format";
import type { AppointmentSummary } from "@/lib/types";

const TILES: Array<{ key: keyof Omit<AppointmentSummary, "nextAppointment">; label: string }> = [
  { key: "upcoming", label: "Upcoming" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
];

export function SummaryTiles({ summary }: { summary: AppointmentSummary | null }) {
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TILES.map((tile) => (
          <div key={tile.key} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <p className="text-xs text-slate-500">{tile.label}</p>
            {summary ? (
              <p className="mt-1 text-xl font-semibold text-slate-900">{summary[tile.key]}</p>
            ) : (
              <div className="mt-2 h-5 w-8 animate-pulse rounded bg-slate-100" />
            )}
          </div>
        ))}
      </div>

      {summary?.nextAppointment && (
        <div className="rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-100">
          <p className="text-xs font-medium text-indigo-700">
            Next up {relativeDay(summary.nextAppointment.scheduledAt).toLowerCase()}
          </p>
          <p className="mt-0.5 text-sm text-indigo-900">
            {summary.nextAppointment.service} at {formatSlot(summary.nextAppointment.scheduledAt)}
          </p>
        </div>
      )}
    </section>
  );
}
