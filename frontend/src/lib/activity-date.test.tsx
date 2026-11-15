import { expect, it } from "vitest";
import { activityDateMatches } from "./activity-date";

it("filters inclusive calendar days in Manila", () => {
  expect(activityDateMatches("2026-11-14T16:00:00Z", "2026-11-15", "2026-11-15")).toBe(true);
  expect(activityDateMatches("2026-11-14T15:59:59Z", "2026-11-15", "")).toBe(false);
  expect(activityDateMatches("2026-11-15T16:00:00Z", "", "2026-11-15")).toBe(false);
  expect(activityDateMatches("2026-11-15T15:59:59Z", "", "2026-11-15")).toBe(true);
});

it("allows an empty filter and yields no matches for reversed dates", () => {
  expect(activityDateMatches("2026-11-15T00:00:00Z", "", "")).toBe(true);
  expect(activityDateMatches("2026-11-15T00:00:00Z", "2026-11-16", "2026-11-14")).toBe(false);
});
