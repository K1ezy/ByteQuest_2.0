import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

it("treats an old Exams filter as practice and only shows the practice categories", async () => {
  mocks.params = new URLSearchParams("category=exams");
  mocks.api.mockResolvedValue([]);
  render(<QuestsPage />);
  expect(await screen.findByRole("heading", { name: "No published activities yet" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Concept check quiz" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Exams" })).toBeNull();
  expect(mocks.api.mock.calls.map(([path]) => path)).toEqual(["/quests"]);
});

it("shows the selected activity's history, ignores a late response, and closes on Escape or filtering", async () => {
  const quiz = { ...quest, id: "quiz", title: "Loop quiz", activity_type: "quiz" };
  let resolveChallenge!: (data: object) => void;
  let aborted: AbortSignal | undefined;
  mocks.api.mockImplementation((path: string, init?: RequestInit) => {
    if (path === "/quests") return Promise.resolve([quest, quiz]);
    if (path === "/quests/one/performance-preview") {
      aborted = init?.signal ?? undefined;
      return new Promise((resolve) => { resolveChallenge = resolve; });
    }
    return Promise.resolve({ scope: "course", total: 4, passed: 3, pass_marked: 4 });
  });
  render(<QuestsPage />);
  fireEvent.click(await screen.findByRole("heading", { name: "Repeat a step" }));
  expect(screen.getByText("Loading past results…")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Performance preview for Loop quiz" }));
  const panel = await screen.findByRole("region", { name: "Performance preview for Loop quiz" });
  expect(await within(panel).findByText("3 of 4")).toBeTruthy();
  expect(within(panel).getByText("Passed on the first try")).toBeTruthy();
  expect(within(panel).getByText("Needed another try").nextElementSibling?.textContent).toBe("1");
  expect(within(panel).getByText("Your record in this course")).toBeTruthy();
  expect(within(panel).getByRole("img", { name: "75% passed on the first try" })).toBeTruthy();
  expect(within(panel).getByText("You usually pass these on your first try.")).toBeTruthy();
  const facts = within(panel).getByRole("list", { name: "Activity details" });
  expect(within(facts).getByText("Difficulty 1 of 5")).toBeTruthy();
  expect(within(facts).getByText("20 XP")).toBeTruthy();
  expect(within(panel).getByText("#1")).toBeTruthy();
  expect(aborted?.aborted).toBe(true);
  await act(async () => resolveChallenge({ scope: "workshop", total: 2, passed: 1 }));
  expect(screen.queryByText("1 of 2")).toBeNull();
  fireEvent.keyDown(screen.getByRole("button", { name: "Close performance preview" }), { key: "Escape" });
  expect(screen.queryByRole("region", { name: "Performance preview for Loop quiz" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Performance preview for Loop quiz" }));
  fireEvent.click(screen.getByRole("button", { name: "Performance preview for Loop quiz" }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Repeat a step" } });
  expect(screen.queryByRole("region", { name: "Performance preview for Loop quiz" })).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  expect(screen.queryByRole("region", { name: "Performance preview for Loop quiz" })).toBeNull();
});

it("keeps the activity tip available and dismisses the preview when focus leaves the card", async () => {
  mocks.api.mockImplementation(async (path: string) => path === "/quests" ? [quest] : {
    scope: "workshop", total: 0, pass_marked: 0, passed: 0,
  });
  render(<QuestsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Performance preview for Repeat a step" }));
  const panel = screen.getByRole("region", { name: "Performance preview for Repeat a step" });
  expect(await within(panel).findByText("No comparable results yet.")).toBeTruthy();
  expect(within(panel).getByText(/first of these code challenges here/)).toBeTruthy();
  expect(within(panel).getByText("Before you start")).toBeTruthy();
  expect(within(panel).getByText("Run the sample cases before you submit.")).toBeTruthy();
  fireEvent.click(within(panel).getByText("Before you start"));
  expect(panel.isConnected).toBe(true);
  const search = screen.getByRole("searchbox");
  act(() => search.focus());
  expect(panel.isConnected).toBe(false);
  expect(document.activeElement).toBe(search);
});

it("shows zero passes as real practice history", async () => {
  mocks.api.mockImplementation(async (path: string) => path === "/quests" ? [quest] : {
    scope: "workshop", total: 2, pass_marked: 2, passed: 0,
  });
  render(<QuestsPage />);
  fireEvent.click(await screen.findByRole("heading", { name: "Repeat a step" }));
  expect(await screen.findByText("0 of 2")).toBeTruthy();
  expect(screen.getByText("Needed another try").nextElementSibling?.textContent).toBe("2");
  expect(screen.getByText("Based on 2 earlier results only, so the pattern is still forming.")).toBeTruthy();
});
