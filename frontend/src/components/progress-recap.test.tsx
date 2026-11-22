import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiRequest: mocks.apiRequest };
});

import { ProgressRecap, type ProgressRecapData } from "./progress-recap";

const metric = (key: ProgressRecapData["metrics"][number]["key"], label: string, current: number, previous: number, usual: number | null) =>
  ({ key, label, current, previous, change: current - previous, usual });

const recap = (days: number, overrides: Partial<ProgressRecapData> = {}): ProgressRecapData => ({
  days, period_start: "2026-11-13", period_end: "2026-11-15", previous_start: "2026-11-10", previous_end: "2026-11-12",
  enough_activity: true,
  comparison: "ok",
  metrics: [
    metric("solved", "Challenges solved", 2, 1, 0.5),
    metric("self_solved", "Self-solved", 1, 1, 0.5),
    metric("active_days", "Active days", 2, 3, 1),
  ],
  ...overrides,
});

beforeEach(() => {
  mocks.apiRequest.mockReset();
  window.localStorage.clear();
});
afterEach(cleanup);

it("compares the chosen period in words and remembers the choice", async () => {
  mocks.apiRequest.mockImplementation(async (path: string) => recap(Number(new URL(path, "http://x").searchParams.get("days"))));
  render(<ProgressRecap userId="student-1" />);

  expect(await screen.findByText("+1 vs previous 7 days")).toBeTruthy();
  expect(mocks.apiRequest).toHaveBeenCalledWith("/quests/progress-recap?days=7");
  expect(screen.getByText("Same as previous 7 days")).toBeTruthy();
  expect(screen.getByText("1 fewer than previous 7 days")).toBeTruthy();
  expect(screen.getByText("Usual: about 1 day per 7 days")).toBeTruthy();
  expect(screen.getByText("Nov 13–Nov 15 compared with Nov 10–Nov 12")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "3 days" }));
  await waitFor(() => expect(mocks.apiRequest).toHaveBeenLastCalledWith("/quests/progress-recap?days=3"));
  expect(await screen.findByRole("heading", { name: "Last 3 days" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "3 days" }).getAttribute("aria-pressed")).toBe("true");
  expect(window.localStorage.getItem("bytequest:recap-days:student-1")).toBe("3");
});

it("restores a remembered period", async () => {
  window.localStorage.setItem("bytequest:recap-days:student-1", "30");
  mocks.apiRequest.mockResolvedValue(recap(30));
  render(<ProgressRecap userId="student-1" />);
  await waitFor(() => expect(mocks.apiRequest).toHaveBeenCalledWith("/quests/progress-recap?days=30"));
});

it("shows true counts but no changes when there is too little activity", async () => {
  mocks.apiRequest.mockResolvedValue(recap(7, { enough_activity: false, comparison: "too_little_activity" }));
  render(<ProgressRecap userId="student-1" />);
  expect(await screen.findByText(/Not enough activity yet to compare/)).toBeTruthy();
  expect(screen.getByText("Challenges solved")).toBeTruthy();
  expect(screen.queryByText(/vs previous|fewer than|Same as/)).toBeNull();
});

it("explains when the learner started too recently for a fair comparison", async () => {
  mocks.apiRequest.mockResolvedValue(recap(30, { enough_activity: false, comparison: "new_learner" }));
  render(<ProgressRecap userId="student-1" />);
  expect(await screen.findByText(/no full earlier period to compare yet/)).toBeTruthy();
  expect(screen.queryByText(/vs previous|fewer than|Same as/)).toBeNull();
});

it("frames a quieter period as an invitation, never as doing worse", async () => {
  mocks.apiRequest.mockResolvedValue(recap(7, {
    metrics: [metric("solved", "Challenges solved", 0, 2, 1), metric("active_days", "Active days", 1, 3, 2)],
  }));
  render(<ProgressRecap userId="student-1" />);
  expect(await screen.findByText(/Ready to get back into it\?/)).toBeTruthy();
  expect(screen.getByRole("link", { name: /Open the Quest Map/ }).getAttribute("href")).toBe("/quests");
  expect(screen.queryByText(/worse|failed|decline/i)).toBeNull();
});
