import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("@/components/app-shell", () => ({
  useShellProfile: () => ({ username: "kieser", display_name: null, enrolled_language: "python" }),
}));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiRequest: mocks.apiRequest };
});

import Page from "./page";

const attempt = (index: number) => ({
  attempt_id: `attempt${index}`, activity_id: `activity${index}`, title: `Task ${index}`,
  activity_type: index % 2 ? "quiz" : "challenge", score_percentage: index % 2 ? 100 : 40,
  is_successful: index % 2 === 1, created_at: "2026-11-11T03:32:00Z",
});

afterEach(() => { cleanup(); mocks.apiRequest.mockReset(); });

it("shows track progress, XP to the next level, and collapses long attempt history", async () => {
  mocks.apiRequest.mockImplementation((path: string) => Promise.resolve(path.startsWith("/pilot") ? {
    recommendation: { rationale: "More practice is recommended.", target_activity_id: "next" },
    next_activity: { id: "next", title: "Even or Odd", kind: "challenge" },
    completed: 5, total: 9, xp: 340, level: 2, pending_job_id: null, due_exam: null, notices: [],
  } : {
    total_attempts: 7, attempts: Array.from({ length: 7 }, (_, index) => attempt(index + 1)),
    badges: [{ code: "first", name: "First Steps", description: "Finish a quest." }],
  }));

  render(<Page />);

  expect(await screen.findByText("4 activities left to finish the PYTHON track.")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/^Good (morning|afternoon|evening), Kieser!$/);
  expect(screen.getByRole("progressbar", { name: "Quest completion" }).getAttribute("aria-valuenow")).toBe("56");
  expect(screen.getByText("160 XP to Level 3")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Continue quest/ }).getAttribute("href")).toBe("/arena/next");

  expect(screen.getAllByRole("link", { name: /^Task \d/ })).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "Show all 7" }));
  expect(screen.getAllByRole("link", { name: /^Task \d/ })).toHaveLength(7);
  expect(screen.getByRole("button", { name: "Show fewer" }).getAttribute("aria-expanded")).toBe("true");
});
