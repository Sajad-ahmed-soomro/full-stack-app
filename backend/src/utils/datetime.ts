export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_24H_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function isTime24h(value: string): boolean {
  return TIME_24H_PATTERN.test(value);
}

export function combineDateAndTime(date: string, time: string): Date | null {
  if (!isIsoDate(date) || !isTime24h(time)) return null;
  const parsed = new Date(`${date}T${time}:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function splitDateAndTime(value: Date): { date: string; time: string } {
  const iso = value.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function isInFuture(value: Date, now = new Date()): boolean {
  return value.getTime() > now.getTime();
}

export function alignsWithSlot(value: Date, slotMinutes: number): boolean {
  return value.getUTCMinutes() % slotMinutes === 0 && value.getUTCSeconds() === 0;
}

export function fitsBusinessHours(
  value: Date,
  durationMinutes: number,
  openingHour: number,
  closingHour: number,
): boolean {
  const startMinutes = value.getUTCHours() * 60 + value.getUTCMinutes();
  const endMinutes = startMinutes + durationMinutes;
  return startMinutes >= openingHour * 60 && endMinutes <= closingHour * 60;
}

export function formatSlotLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(value);
}

export function resolveRelativeDate(text: string, now = new Date()): string | null {
  const normalised = text.toLowerCase();

  if (/\btoday\b/.test(normalised)) return toIsoDate(now);
  if (/\btomorrow\b/.test(normalised)) return toIsoDate(new Date(now.getTime() + DAY_MS));
  if (/\bday after tomorrow\b/.test(normalised)) {
    return toIsoDate(new Date(now.getTime() + 2 * DAY_MS));
  }

  const explicitIso = normalised.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicitIso?.[1] && isIsoDate(explicitIso[1])) return explicitIso[1];

  const weekdayMatch = normalised.match(
    /\b(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (weekdayMatch?.[1]) {
    const targetIndex = WEEKDAYS.indexOf(weekdayMatch[1] as (typeof WEEKDAYS)[number]);
    const currentIndex = now.getUTCDay();
    let delta = (targetIndex - currentIndex + 7) % 7;
    if (delta === 0 || normalised.includes("next ")) delta = delta === 0 ? 7 : delta;
    return toIsoDate(new Date(now.getTime() + delta * DAY_MS));
  }

  return null;
}

export function resolveTimeExpression(text: string): string | null {
  const normalised = text.toLowerCase().replace(/\s+/g, " ");

  const meridiem = normalised.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (meridiem?.[1] && meridiem[3]) {
    let hour = Number(meridiem[1]);
    const minute = Number(meridiem[2] ?? "0");
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (meridiem[3] === "pm" && hour !== 12) hour += 12;
    if (meridiem[3] === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const twentyFour = normalised.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFour?.[1] && twentyFour[2]) {
    return `${twentyFour[1].padStart(2, "0")}:${twentyFour[2]}`;
  }

  const bareHour = normalised.match(/\bat (\d{1,2})\b/);
  if (bareHour?.[1]) {
    const hour = Number(bareHour[1]);
    if (hour >= 0 && hour <= 23) return `${String(hour).padStart(2, "0")}:00`;
  }

  return null;
}
