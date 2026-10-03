"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api-client";
import type { Appointment, AppointmentStatus, AppointmentSummary } from "./types";

export function useAppointments(enabled: boolean) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [summary, setSummary] = useState<AppointmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, stats] = await Promise.all([
        api.appointments({ limit: 50 }),
        api.appointmentSummary(),
      ]);
      setAppointments(list.appointments);
      setSummary(stats.summary);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const load = async () => {
      await refresh();
    };

    void load();
  }, [enabled, refresh]);

  const applyUpdate = useCallback((updated: Appointment) => {
    setAppointments((current) => {
      const next = current.some((appointment) => appointment.id === updated.id)
        ? current.map((appointment) => (appointment.id === updated.id ? updated : appointment))
        : [...current, updated];
      return next.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    });
  }, []);

  const setStatus = useCallback(
    async (id: string, status: AppointmentStatus) => {
      try {
        const { appointment } =
          status === "cancelled"
            ? await api.cancelAppointment(id)
            : await api.updateAppointment(id, { status });
        applyUpdate(appointment);
        void refresh();
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : "Could not update the appointment");
      }
    },
    [applyUpdate, refresh],
  );

  return {
    appointments,
    summary,
    loading,
    error,
    refresh,
    applyUpdate,
    setStatus,
    clearError: () => setError(null),
  };
}
