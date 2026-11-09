import { config } from "../config.js";
import { DAYS, type BookingSettings } from "./settings.js";

export const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const fromMinutes = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

/** Current date ("YYYY-MM-DD") and minutes past midnight in the studio's time zone. */
export function studioNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: config.TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Opening hours for a "YYYY-MM-DD" date, or null when the studio is closed. */
export function hoursFor(date: string, settings: BookingSettings) {
  const day = DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return settings.hours[day] ?? null;
}

/** Start times on a date, from opening until the service would run past closing. */
export function slotsFor(date: string, durationMinutes: number, settings: BookingSettings) {
  const hours = hoursFor(date, settings);
  if (!hours) return [];
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  const step = Math.max(5, settings.slot_minutes);
  const slots: string[] = [];
  for (let start = open; start + durationMinutes <= close; start += step) {
    slots.push(fromMinutes(start));
  }
  return slots;
}

/** Returns why a booking time isn't allowed, or null when it is. */
export function bookingTimeProblem(
  date: string,
  time: string,
  durationMinutes: number,
  settings: BookingSettings,
  now = studioNow(),
) {
  if (date < now.date) return "The booking date must be today or later";
  const hours = hoursFor(date, settings);
  if (!hours) return "The studio is closed on that day";
  const start = toMinutes(time);
  if (start < toMinutes(hours.open) || start + durationMinutes > toMinutes(hours.close)) {
    return `Bookings on that day must be between ${hours.open} and ${hours.close}`;
  }
  if (date === now.date && start <= now.minutes) return "That time has already passed";
  return null;
}
