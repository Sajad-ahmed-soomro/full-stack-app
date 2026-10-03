"use client";

import { Button } from "@/components/ui/button";
import { CalendarIcon } from "@/components/ui/icons";
import { StatusBadge, Tag } from "@/components/ui/status-badge";
import { formatSlot, relativeDay } from "@/lib/format";
import type { Appointment, AppointmentStatus } from "@/lib/types";

interface AppointmentListProps {
  appointments: Appointment[];
  loading: boolean;
  onStatusChange: (id: string, status: AppointmentStatus) => Promise<void>;
}

export function AppointmentList({ appointments, loading, onStatusChange }: AppointmentListProps) {
  return (
    <section className="rounded-xl bg-white ring-1 ring-slate-200">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Appointments</h2>
        <span className="text-xs text-slate-500">{appointments.length} total</span>
      </header>

      {loading ? (
        <ul className="divide-y divide-slate-100">
          {[0, 1, 2].map((index) => (
            <li key={index} className="px-4 py-3">
              <div className="h-10 animate-pulse rounded bg-slate-100" />
            </li>
          ))}
        </ul>
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <CalendarIcon className="size-5" />
          </span>
          <p className="text-sm text-slate-600">No appointments yet</p>
          <p className="max-w-xs text-xs text-slate-500">
            Ask the assistant for a slot or use the booking form and it will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {appointments.map((appointment) => (
            <li key={appointment.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {appointment.service}
                  </p>
                  <StatusBadge status={appointment.status} />
                  {appointment.source === "chat" && <Tag tone="info">via chat</Tag>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {relativeDay(appointment.scheduledAt)} &middot; {formatSlot(appointment.scheduledAt)} &middot;{" "}
                  {appointment.durationMinutes} min
                </p>
                <p className="truncate text-xs text-slate-400">
                  {appointment.customerName} &middot; {appointment.customerEmail}
                </p>
              </div>

              <div className="flex gap-2">
                {appointment.status === "pending" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void onStatusChange(appointment.id, "confirmed")}
                  >
                    Confirm
                  </Button>
                )}
                {appointment.status === "confirmed" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void onStatusChange(appointment.id, "completed")}
                  >
                    Complete
                  </Button>
                )}
                {(appointment.status === "pending" || appointment.status === "confirmed") && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void onStatusChange(appointment.id, "cancelled")}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
