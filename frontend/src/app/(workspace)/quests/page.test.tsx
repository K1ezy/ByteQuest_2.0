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

it("finds a quest by its # number, not by digits inside other titles", async () => {
  const list = Array.from({ length: 9 }, (_, index) => ({
    ...quest, id: `q${index + 1}`, position: index + 1, sequence_order: index + 20,
    title: index === 8 ? "Print 4 squares" : `Quest title ${String.fromCharCode(65 + index)}`,
  }));
  mocks.api.mockResolvedValue(list);
  render(<QuestsPage />);
  await screen.findByRole("heading", { name: "Print 4 squares" });
  const search = screen.getByRole("searchbox");
  const shown = () => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

  fireEvent.change(search, { target: { value: "4" } });
  expect(shown()).toEqual(["Quest title D"]);
  expect(screen.getByText("#4")).toBeTruthy();
  fireEvent.change(search, { target: { value: "#9" } });
  expect(shown()).toEqual(["Print 4 squares"]);
  // Words still search titles, topics and types as before.
  fireEvent.change(search, { target: { value: "squares" } });
  expect(shown()).toEqual(["Print 4 squares"]);
  fireEvent.change(search, { target: { value: "12" } });
  expect(screen.getByRole("heading", { name: "No quests match that view" })).toBeTruthy();
});

it("shows each quest's deadline date and time, and says Closed once it has passed", async () => {
  mocks.api.mockResolvedValue([
    { ...quest, closes_at: "2026-11-25T11:30:00Z" },
    { ...quest, id: "two", title: "Past deadline", closes_at: "2026-11-01T01:00:00Z", is_closed: true },
    { ...quest, id: "three", title: "No deadline" },
  ]);
  render(<QuestsPage />);
  await screen.findByRole("heading", { name: "Repeat a step" });
  const due = screen.getByText((_, node) => node?.tagName === "P" && /^Due /.test(node.textContent ?? ""));
  // 11:30 UTC is 7:30 PM in Manila.
  expect(due.textContent).toMatch(/Nov 25, 2026.*07:30\s?PM/);
  expect(due.querySelector("time")?.getAttribute("dateTime")).toBe("2026-11-25T11:30:00Z");
  expect(screen.getByText((_, node) => node?.tagName === "P" && /^Closed Nov 1, 2026/.test(node.textContent ?? ""))).toBeTruthy();
  expect(screen.getAllByText((_, node) => node?.tagName === "P" && /^(Due|Closed) /.test(node.textContent ?? ""))).toHaveLength(2);
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
