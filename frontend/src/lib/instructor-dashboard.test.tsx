import { expect, it } from "vitest";
import { dashboardHeading, recentActivity, sortAttention, weeklyChange } from "./instructor-dashboard";
import type { QueueItem } from "./workspace";

it.each([
  ["2026-11-16T03:59:00Z", "Good morning", 1, "1 thing needs you today"],
  ["2026-11-16T04:00:00Z", "Good afternoon", 2, "2 things need you today"],
  ["2026-11-16T09:59:00Z", "Good afternoon", 0, "You're all caught up"],
  ["2026-11-16T10:00:00Z", "Good evening", 3, "3 things need you today"],
  ["2026-11-15T16:00:00Z", "Good morning", 0, "You're all caught up"],
])("formats Manila greeting and attention count at %s", (iso, title, count, note) => {
  expect(dashboardHeading(new Date(iso), count)).toEqual({ title, subtitle: note + " · Mon, Nov 16" });
});

it("shows directional weekly changes and handles equal and missing comparison periods", () => {
  expect(weeklyChange(7, 5)).toEqual({ tone: "up", note: "2 vs last week" });
  expect(weeklyChange(5, 7)).toEqual({ tone: "down", note: "2 vs last week" });
  expect(weeklyChange(0, 0)).toEqual({ note: "Same as last week" });
  expect(weeklyChange(5, null)).toEqual({ note: "First week of data" });
});

it("orders attention by status and oldest date within a status", () => {
  const row = (id: string, kind: QueueItem["kind"], status: string, day: number): QueueItem => ({
    id, kind, status, title: id, detail: "", href: "/instructor", course: null,
    severity: "wait", updated_at: `2026-11-${day}T00:00:00Z`,
  });
  expect(sortAttention([row("draft", "draft", "Draft", 11), row("newer", "material", "Failed", 15),
    row("fix", "material", "Needs review", 10), row("older", "material", "Failed", 13)]).map(({ id }) => id))
    .toEqual(["older", "newer", "fix", "draft"]);
});

it("uses a safe fallback when audit entries identify an actor only by an ID", () => {
  expect(recentActivity({ id: "audit", actor: "ca72f258-a40a-4912-8521-dfc8e43e7f64", action: "activity.availability_changed",
    summary: "Changed availability for “Count Vowels” to closed", created_at: "2026-10-28T16:00:00Z" }))
    .toEqual({ actor: "Unknown user", verb: "closed", item: "Count Vowels", day: "Oct 29" });
});
