import { afterEach, expect, it, vi } from "vitest";
import { activityDateMatches, formatManilaDateTime, fromManilaDateTimeInput, toManilaDateTimeInput } from "./activity-date";

afterEach(() => vi.unstubAllEnvs());

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

it.each(["America/New_York", "UTC"])("saves and reloads the same Manila deadline with device timezone %s", (zone) => {
  vi.stubEnv("TZ", zone);
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);

  const deadline = "2027-03-14T02:30";
  const utc = "2027-03-13T18:30:00.000Z";
  expect(fromManilaDateTimeInput(deadline)).toBe(utc);
  expect(toManilaDateTimeInput(utc)).toBe(deadline);
  expect(formatManilaDateTime(utc)).toContain("14");
});

it("rejects an impossible date and handles midnight", () => {
  expect(fromManilaDateTimeInput("2027-02-30T09:00")).toBeNull();
  expect(fromManilaDateTimeInput("2027-03-14T00:00")).toBe("2027-03-13T16:00:00.000Z");
  expect(fromManilaDateTimeInput("")).toBeNull();
});
