import type { ActivityListItem, AuditEntry, QueueItem } from "./workspace";

const zone = "Asia/Manila";
const hourInManila = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hourCycle: "h23" });
const dashboardDay = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric" });
const feedDay = new Intl.DateTimeFormat("en-US", { timeZone: zone, month: "short", day: "numeric" });
const clock = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" });
const weekday = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short" });

export const caughtUp = "You're all caught up";

export function dashboardHeading(now: Date, count: number | null) {
  const hour = Number(hourInManila.format(now));
  const title = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const message = count === null ? null : count === 0 ? caughtUp : count === 1 ? "1 thing needs you today" : `${count} things need you today`;
  return { title, subtitle: [message, dashboardDay.format(now)].filter(Boolean).join(" · ") };
}

export function weeklyChange(current: number, previous: number | null): { note: string; tone?: "up" | "down" } {
  if (previous === null) return { note: "First week of data" };
  if (current === previous) return { note: "Same as last week" };
  return { note: `${Math.abs(current - previous)} vs last week`, tone: current > previous ? "up" : "down" };
}

export function attentionPriority(item: Pick<QueueItem, "kind" | "status">) {
  if (item.kind === "material") return item.status === "Failed" ? 0 : 1;
  return item.kind === "draft" ? 2 : 3;
}

export function sortAttention(items: QueueItem[]) {
  return [...items].sort((a, b) => attentionPriority(a) - attentionPriority(b) ||
    (a.updated_at ? Date.parse(a.updated_at) : Infinity) - (b.updated_at ? Date.parse(b.updated_at) : Infinity) ||
    a.id.localeCompare(b.id));
}

export function upcomingActivities(items: ActivityListItem[], now: Date) {
  const last = now.getTime() + 14 * 86400000;
  return items.flatMap((item) => {
    if (!(["scheduled", "open"].includes(item.state))) return [];
    const events = [["Opens", item.opens_at], ["Closes", item.closes_at]] as const;
    const upcoming = events.flatMap(([verb, value]) => {
      if (!value) return [];
      const date = new Date(value);
      if (!(date.getTime() >= now.getTime() && date.getTime() <= last)) return [];
      return [{ id: item.activity_id, title: item.title || item.topic_concept, date,
        detail: `${verb} ${weekday.format(date)}, ${feedDay.format(date)}, ${clock.format(date)}` }];
    });
    return upcoming.slice(0, 1);
  }).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 4);
}

const activityVerbs: Record<string, string> = {
  "activity.created": "drafted", "activity.updated": "updated", "activity.scheduled": "scheduled",
  "activity.verified": "checked", "activity.published": "published", "activity.archived": "archived",
  "activity.version_created": "created a version of", "draft.revision_saved": "edited",
  "draft.rejected": "returned", "draft.published": "published", "draft.created": "drafted",
  "material.metadata_updated": "updated", "material.archived": "archived", "material.restored": "restored",
  "assignment.created": "assigned", "assignment.confirmed": "confirmed", "assignment.removed": "removed",
};

export function recentActivity(entry: AuditEntry) {
  const name = entry.actor?.trim();
  const actor = name && !/^(?:@?member[a-z]{24,}|@?[a-z]{32,}|stu_[a-f0-9]{28,}|[a-f0-9-]{32,}|system)$/i.test(name) ? name : "Unknown user";
  const date = entry.created_at ? new Date(entry.created_at) : null;
  const day = date && Number.isFinite(date.getTime()) ? feedDay.format(date) : null;
  const namedItem = entry.summary.match(/[“"]([^”"]+)[”"]/)?.[1];
  if (entry.action === "activity.availability_changed" && namedItem) {
    const verb = entry.summary.endsWith(" to closed") ? "closed" : entry.summary.endsWith(" to scheduled") ? "scheduled" : "changed availability for";
    return { actor, verb, item: namedItem, day };
  }
  const verb = namedItem ? activityVerbs[entry.action] : null;
  if (verb && namedItem) return { actor, verb, item: namedItem, day };
  if (entry.action === "material.processing_failed" && namedItem) return { actor, verb: "couldn't process", item: namedItem, day };
  const summary = entry.summary.replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, "a record");
  const sentence = summary.match(/^(Assigned|Confirmed|Created|Updated|Removed|Published|Archived|Restored|Scheduled) (.+)$/);
  if (sentence) return { actor, verb: sentence[1].toLowerCase(), item: sentence[2], day };
  // "Course announcement created." reads as "created a course announcement".
  const trailing = summary.match(/^(.+?) (created|updated|removed|deleted|published|archived|restored|scheduled)\.?$/i);
  if (trailing) {
    const thing = trailing[1].charAt(0).toLowerCase() + trailing[1].slice(1);
    return { actor, verb: trailing[2].toLowerCase(), item: (/^[aeiou]/i.test(thing) ? "an " : "a ") + thing, day };
  }
  return { actor, verb: "recorded", item: summary, day };
}
