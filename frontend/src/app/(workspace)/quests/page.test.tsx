import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ProgrammingLanguage, Quest } from "@/lib/types";

const mocks = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn(), params: new URLSearchParams(), language: "python" as ProgrammingLanguage | null }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/quests",
  useRouter: () => ({ push: mocks.push, replace: mocks.push }),
  useSearchParams: () => mocks.params,
}));
vi.mock("@/components/app-shell", () => ({ useShellProfile: () => ({ role: "student", enrolled_language: mocks.language }) }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(), apiRequest: mocks.api,
}));

import QuestsPage from "./page";

const quest: Quest = {
  id: "one", title: "Repeat a step", activity_type: "challenge", language: "python",
  topic_concept: "Loops", difficulty_level: 1, sequence_order: 1, added_at: "",
  added_at_estimated: false, xp_reward: 20, problem_statement: null, starter_code: null, is_completed: true,
};
beforeEach(() => {
  mocks.params = new URLSearchParams();
  mocks.language = "python";
  mocks.push.mockReset();
  mocks.api.mockReset();
});
afterEach(cleanup);

it("opens a concept from Profile as an exact Quest Map filter", async () => {
  mocks.params = new URLSearchParams("concept=Loops");
  mocks.api.mockResolvedValue([quest, { ...quest, id: "two", title: "Loops in a different concept", topic_concept: "Strings" }]);
  const { rerender } = render(<QuestsPage />);

  expect(await screen.findByRole("heading", { name: "Repeat a step" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Loops in a different concept" })).toBeNull();
  expect(screen.queryByRole("progressbar")).toBeNull();
  const search = screen.getByRole("searchbox") as HTMLInputElement;
  expect(search.value).toBe("Loops");
  // Keep the typed text while the router removes the exact concept filter.
  fireEvent.change(search, { target: { value: "Loopsx" } });
  expect(search.value).toBe("Loopsx");
  expect(mocks.push).toHaveBeenLastCalledWith("/quests", { scroll: false });
  fireEvent.change(search, { target: { value: "" } });
  mocks.params = new URLSearchParams();
  rerender(<QuestsPage />);
  expect(screen.getByRole("heading", { name: "Loops in a different concept" })).toBeTruthy();
});

it("keeps all four categories visible and opens Exams when there are no practice quests", async () => {
  const list = [{
    id: "exam-one", title: "Midterm", exam_number: 1, added_at: "2026-11-24T03:00:00Z",
    opens_at: "2026-11-24T03:00:00Z", closes_at: "2026-11-25T03:00:00Z",
    duration_minutes: 30, results_released: false, can_start: false, can_resume: true,
  }];
  mocks.api.mockImplementation(async (path: string) => path === "/exams" ? list : []);
  const { rerender } = render(<QuestsPage />);
  expect(await screen.findByRole("heading", { name: "No published activities yet" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Concept check quiz" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Exams" }));
  expect(mocks.push).toHaveBeenCalledWith("/quests?category=exams", { scroll: false });

  mocks.params = new URLSearchParams("category=exams");
  rerender(<QuestsPage />);
  expect(screen.getByRole("button", { name: "Exams", pressed: true })).toBeTruthy();
  expect((await screen.findByRole("link", { name: "Resume exam" })).getAttribute("href")).toBe("/exams/exam-one");
  expect(screen.queryByRole("searchbox", { name: "Search quests" })).toBeNull();
});

it("keeps assigned exams reachable before a student chooses a language", async () => {
  mocks.language = null;
  mocks.api.mockResolvedValue([]);
  const { rerender } = render(<QuestsPage />);
  expect(screen.getByRole("link", { name: "Go to Workshops" }).getAttribute("href")).toBe("/workshops");
  expect(mocks.api).not.toHaveBeenCalled();

  mocks.params = new URLSearchParams("category=exams");
  rerender(<QuestsPage />);
  expect(await screen.findByRole("heading", { name: "No assigned exams yet" })).toBeTruthy();
  expect(mocks.api.mock.calls.map(([path]) => path)).toEqual(["/exams"]);
});
