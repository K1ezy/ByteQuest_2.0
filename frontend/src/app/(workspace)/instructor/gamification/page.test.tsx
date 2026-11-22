import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), courseId: "course-1" as string | null }));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiRequest: mocks.apiRequest };
});
vi.mock("@/components/workspace/workspace-provider", () => ({
  useWorkspace: () => ({ courseId: mocks.courseId }),
  WorkspaceSuspense: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import Page from "./page";

beforeEach(() => {
  mocks.apiRequest.mockReset();
  mocks.courseId = "course-1";
});
afterEach(cleanup);

it("requests insights for the selected course and explains an empty course", async () => {
  mocks.apiRequest.mockResolvedValue({
    course_id: "course-1", course_code: "CS1", course_title: "Introduction to Python", generated_at: "2026-11-15T08:00:00Z",
    enrolled: 0, active: 0, weekly: [], rollout: { codex_unlock_day: 21, memory_unlock_day: 35 },
    solve_quality: { solved: 0, stars: { "1": 0, "2": 0, "3": 0 }, self_solved_rate: null },
    help_seeking: { hinted: 0, tried_before_hint: 0, rate: null }, topics: [],
    memory: { submitted: 0, passed: 0, pass_rate: null, stages: [] },
  });
  render(<Page />);
  expect(await screen.findByRole("heading", { name: "No students enrolled yet" })).toBeTruthy();
  expect(mocks.apiRequest.mock.calls[0][0]).toBe("/faculty/gamification-insights?course_id=course-1");
  expect(screen.getByRole("heading", { name: "Gamification Insights" })).toBeTruthy();
});

it("asks for a course instead of calling the API without one", () => {
  mocks.courseId = null;
  render(<Page />);
  expect(screen.getByText("Choose a course to see its insights.")).toBeTruthy();
  expect(mocks.apiRequest).not.toHaveBeenCalled();
});
