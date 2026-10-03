const DATE_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const DATE_TIME_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const CLOCK_LABEL = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDate(isoDate: string): string {
  return DATE_LABEL.format(new Date(`${isoDate}T00:00:00.000Z`));
}

export function formatSlot(isoTimestamp: string): string {
  return `${DATE_TIME_LABEL.format(new Date(isoTimestamp))} UTC`;
}

export function formatMessageTime(isoTimestamp: string): string {
  return CLOCK_LABEL.format(new Date(isoTimestamp));
}

export function relativeDay(isoTimestamp: string, now = new Date()): string {
  const target = new Date(isoTimestamp);
  const days = Math.round(
    (Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()) -
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) /
      86_400_000,
  );

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days < -1 && days > -7) return `${Math.abs(days)} days ago`;
  return formatDate(target.toISOString().slice(0, 10));
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildTimeOptions(
  openingHour: number,
  closingHour: number,
  slotMinutes: number,
): string[] {
  const options: string[] = [];

  for (let minutes = openingHour * 60; minutes + slotMinutes <= closingHour * 60; minutes += slotMinutes) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    options.push(`${hour}:${minute}`);
  }

  return options;
}
