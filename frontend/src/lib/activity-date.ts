const manilaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
});
const displayDate = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium",
});
const manilaInput = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const manilaDisplay = new Intl.DateTimeFormat(undefined, {
  timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

export function toManilaDateTimeInput(value: string | null | undefined): string {
  const instant = new Date(value ?? "");
  if (!Number.isFinite(instant.getTime())) return "";
  const parts = Object.fromEntries(manilaInput.formatToParts(instant).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromManilaDateTimeInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  // Manila uses UTC+08:00 for the dates that can be scheduled in ByteQuest.
  const instant = new Date(`${value}:00+08:00`);
  if (!Number.isFinite(instant.getTime())) return null;
  const utc = instant.toISOString();
  return toManilaDateTimeInput(utc) === value ? utc : null;
}

export function formatManilaDateTime(value: string | null | undefined): string {
  const instant = new Date(value ?? "");
  return Number.isFinite(instant.getTime()) ? manilaDisplay.format(instant) : "—";
}

export function activityDateMatches(value: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const day = manilaDay.format(date);
  return (!from || day >= from) && (!to || day <= to);
}

export function formatActivityDate(value: string): string {
  return displayDate.format(new Date(value));
}
