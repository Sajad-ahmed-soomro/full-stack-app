"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";
import { buildTimeOptions, todayIso } from "@/lib/format";
import type { Appointment, BookingDraft, PublicBusiness } from "@/lib/types";

interface BookingFormProps {
  business: PublicBusiness;
  draft: BookingDraft | null;
  sessionId: string | null;
  suggested: boolean;
  onCreated: (appointment: Appointment) => void;
}

interface FormState {
  service: string;
  date: string;
  time: string;
  customerName: string;
  customerEmail: string;
  notes: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (form.service.trim().length < 2) errors.service = "Tell us what the appointment is for";
  if (!form.date) errors.date = "Pick a date";
  else if (form.date < todayIso()) errors.date = "Pick a date that is not in the past";
  if (!form.time) errors.time = "Pick a time";
  if (form.customerName.trim().length < 2) errors.customerName = "Add the customer name";
  if (!EMAIL_PATTERN.test(form.customerEmail)) errors.customerEmail = "Add a valid email";

  return errors;
}

export function BookingForm({
  business,
  draft,
  sessionId,
  suggested,
  onCreated,
}: BookingFormProps) {
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const [edits, setEdits] = useState<Partial<FormState>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const open = openOverride ?? suggested;

  const form: FormState = {
    service: edits.service ?? draft?.service ?? "",
    date: edits.date ?? draft?.date ?? "",
    time: edits.time ?? draft?.time ?? "",
    customerName: edits.customerName ?? draft?.customerName ?? "",
    customerEmail: edits.customerEmail ?? draft?.customerEmail ?? "",
    notes: edits.notes ?? draft?.notes ?? "",
  };

  const update = <Key extends keyof FormState>(key: Key, value: string) => {
    setEdits((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async () => {
    const validationErrors = validate(form);
    setErrors(validationErrors);
    setFailure(null);

    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);

    try {
      const { appointment } = await api.createAppointment({
        service: form.service.trim(),
        date: form.date,
        time: form.time,
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        durationMinutes: business.slotMinutes,
        notes: form.notes.trim() || undefined,
        chatSessionId: sessionId ?? undefined,
      });

      onCreated(appointment);
      setNotice(`${appointment.service} booked for ${appointment.date} at ${appointment.time} UTC`);
      setEdits({
        service: "",
        date: "",
        time: "",
        notes: "",
        customerName: form.customerName,
        customerEmail: form.customerEmail,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors({
          service: error.fieldMessage("service"),
          date: error.fieldMessage("date"),
          time: error.fieldMessage("time"),
          customerName: error.fieldMessage("customerName"),
          customerEmail: error.fieldMessage("customerEmail"),
        });
        setFailure(error.issues.length > 0 ? "Check the highlighted fields" : error.message);
      } else {
        setFailure("Could not create the appointment");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const timeOptions = buildTimeOptions(
    business.openingHour,
    business.closingHour,
    business.slotMinutes,
  );

  return (
    <section className="rounded-xl bg-white ring-1 ring-slate-200">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Booking form</h2>
          <p className="text-xs text-slate-500">
            {suggested
              ? "The assistant suggested finishing the booking here"
              : "A structured alternative to the chat"}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpenOverride(!open)}>
          {open ? "Hide" : "Open"}
        </Button>
      </header>

      {open && (
        <form
          className="space-y-3 border-t border-slate-200 px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label="Service" htmlFor="service" error={errors.service}>
            <TextInput
              id="service"
              value={form.service}
              invalid={Boolean(errors.service)}
              placeholder="Consultation"
              onChange={(event) => update("service", event.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="date" error={errors.date}>
              <TextInput
                id="date"
                type="date"
                min={todayIso()}
                value={form.date}
                invalid={Boolean(errors.date)}
                onChange={(event) => update("date", event.target.value)}
              />
            </Field>
            <Field
              label="Time"
              htmlFor="time"
              error={errors.time}
              hint={`${String(business.openingHour).padStart(2, "0")}:00 to ${String(
                business.closingHour,
              ).padStart(2, "0")}:00 UTC`}
            >
              <Select
                id="time"
                value={form.time}
                invalid={Boolean(errors.time)}
                onChange={(event) => update("time", event.target.value)}
              >
                <option value="">Select</option>
                {timeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Customer name" htmlFor="customerName" error={errors.customerName}>
            <TextInput
              id="customerName"
              value={form.customerName}
              invalid={Boolean(errors.customerName)}
              onChange={(event) => update("customerName", event.target.value)}
            />
          </Field>

          <Field label="Customer email" htmlFor="customerEmail" error={errors.customerEmail}>
            <TextInput
              id="customerEmail"
              type="email"
              value={form.customerEmail}
              invalid={Boolean(errors.customerEmail)}
              onChange={(event) => update("customerEmail", event.target.value)}
            />
          </Field>

          <Field label="Notes" htmlFor="notes" hint="Optional">
            <TextArea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
            />
          </Field>

          {failure && <Alert message={failure} onDismiss={() => setFailure(null)} />}
          {notice && <Alert tone="success" message={notice} onDismiss={() => setNotice(null)} />}

          <Button type="submit" loading={submitting} className="w-full">
            Book appointment
          </Button>
        </form>
      )}
    </section>
  );
}
