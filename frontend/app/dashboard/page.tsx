"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { AppointmentList } from "@/components/appointments/appointment-list";
import { BookingForm } from "@/components/appointments/booking-form";
import { SummaryTiles } from "@/components/appointments/summary-tiles";
import { ChatPanel } from "@/components/chat/chat-panel";
import { DraftSummary } from "@/components/chat/draft-summary";
import { AppHeader } from "@/components/layout/app-header";
import { Alert } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth-context";
import { useAppointments } from "@/lib/use-appointments";
import { useChat } from "@/lib/use-chat";
import type { Appointment } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const { business, status } = useAuth();
  const signedIn = status === "authenticated";

  const appointments = useAppointments(signedIn);

  const handleAppointment = useCallback(
    (appointment: Appointment) => {
      appointments.applyUpdate(appointment);
      void appointments.refresh();
    },
    [appointments],
  );

  const chat = useChat({ enabled: signedIn, onAppointment: handleAppointment });

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (!signedIn || !business) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Loading your workspace</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex h-[70vh] min-h-125 flex-col lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
          <ChatPanel
            messages={chat.messages}
            thinking={chat.thinking}
            loading={chat.loading}
            error={chat.error}
            transport={chat.transport}
            onSend={chat.send}
            onReset={chat.reset}
            onDismissError={chat.dismissError}
          />
        </div>

        <div className="space-y-4">
          <SummaryTiles summary={appointments.summary} />

          {chat.draft && <DraftSummary draft={chat.draft} />}

          <BookingForm
            business={business}
            draft={chat.draft}
            sessionId={chat.sessionId}
            suggested={chat.needsForm}
            onCreated={handleAppointment}
          />

          {appointments.error && (
            <Alert message={appointments.error} onDismiss={appointments.clearError} />
          )}

          <AppointmentList
            appointments={appointments.appointments}
            loading={appointments.loading}
            onStatusChange={appointments.setStatus}
          />
        </div>
      </main>
    </div>
  );
}
