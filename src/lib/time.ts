export const TIME_ZONES = [
  { id: "America/New_York", label: "Eastern time" },
  { id: "America/Chicago", label: "Central time" },
  { id: "America/Denver", label: "Mountain time" },
  { id: "America/Phoenix", label: "Arizona time" },
  { id: "America/Los_Angeles", label: "Pacific time" },
  { id: "America/Anchorage", label: "Alaska time" },
  { id: "Pacific/Honolulu", label: "Hawaii time" },
] as const;

export type TimeZoneId = (typeof TIME_ZONES)[number]["id"];

const ZONE_IDS = new Set<string>(TIME_ZONES.map((zone) => zone.id));

export function isTimeZone(value: string): value is TimeZoneId {
  return ZONE_IDS.has(value);
}

export function wallParts(iso: string | null, timeZone: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  let hour = pick("hour");
  if (hour === "24") hour = "00";
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    time: `${hour.padStart(2, "0")}:${pick("minute").padStart(2, "0")}`,
  };
}

function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  let hour = pick("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), hour, pick("minute"), pick("second"));
  return asUtc - instant.getTime();
}

export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const first = offsetMs(utcGuess, timeZone);
  const adjusted = new Date(utcGuess.getTime() - first);
  const second = offsetMs(adjusted, timeZone);
  if (second !== first) return new Date(utcGuess.getTime() - second);
  return adjusted;
}

export function parseWall(date: string, time: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const utc = zonedToUtc(date, time, timeZone);
  const back = wallParts(utc.toISOString(), timeZone);
  if (back.date !== date || back.time !== time) return null;
  return utc;
}

export function scheduleParts(event: {
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
}): { date: string; time: string } | null {
  if (!event.startsAt) return null;
  const start = new Date(event.startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const zone = event.timeZone;
  const dateText = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(start);
  const clock = (instant: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
    }).format(instant);
  const zoneName =
    new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" })
      .formatToParts(start)
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  const zoneSuffix = zoneName ? ` ${zoneName}` : "";
  if (!event.endsAt) return { date: dateText, time: `${clock(start)}${zoneSuffix}`.trim() };
  const end = new Date(event.endsAt);
  if (Number.isNaN(end.getTime())) return { date: dateText, time: `${clock(start)}${zoneSuffix}`.trim() };
  const sameDay = wallParts(start.toISOString(), zone).date === wallParts(end.toISOString(), zone).date;
  if (sameDay) return { date: dateText, time: `${clock(start)} – ${clock(end)}${zoneSuffix}`.trim() };
  const endDate = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(end);
  return { date: dateText, time: `${clock(start)} – ${endDate}, ${clock(end)}${zoneSuffix}`.trim() };
}

export function formatSchedule(event: {
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
}): string | null {
  const parts = scheduleParts(event);
  if (!parts) return null;
  return `${parts.date} · ${parts.time}`;
}

export function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
