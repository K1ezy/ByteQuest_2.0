const manilaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
});
const displayDate = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium",
});

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
