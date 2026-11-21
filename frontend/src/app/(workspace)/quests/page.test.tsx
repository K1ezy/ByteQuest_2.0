import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MasteryConcept, Quest } from "@/lib/types";

const mocks = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/quests",
  useRouter: () => ({ push: mocks.push, replace: mocks.push }),
  useSearchParams: () => mocks.params,
}));
vi.mock("@/components/app-shell", () => ({ useShellProfile: () => ({ role: "student", enrolled_language: "python" }) }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(), apiRequest: mocks.api,
}));

import QuestsPage from "./page";

const quest: Quest = {
  id: "one", title: "Repeat a step", activity_type: "challenge", language: "python",
  topic_concept: "Loops", difficulty_level: 1, sequence_order: 1, added_at: "",
  added_at_estimated: false, xp_reward: 20, problem_statement: null, starter_code: null, is_completed: true,
};
const loops: MasteryConcept = {
  concept: "Loops", total: 3, completed: 2, mastery_percent: 67, state: "in_progress",
  average_stars: 2.5, weak_spot: "logic_error", activity_ids: ["one"],
};

beforeEach(() => {
  mocks.params = new URLSearchParams();
  mocks.push.mockReset();
  mocks.api.mockReset();
});
afterEach(cleanup);

it("syncs the mastery view with the URL and uses a node to filter the quest list", async () => {
  mocks.api.mockImplementation(async (path: string) => path === "/quests"
    ? [quest, { ...quest, id: "two", title: "Loops in a different concept", topic_concept: "Strings" }]
    : { track: "python", concepts: [loops] });
  const { rerender } = render(<QuestsPage />);
  expect(await screen.findByRole("button", { name: "List", pressed: true })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mastery map" }));
  expect(mocks.push).toHaveBeenLastCalledWith("/quests?view=map", { scroll: false });
  mocks.params = new URLSearchParams("view=map");
  rerender(<QuestsPage />);
  expect(screen.getByRole("button", { name: "Mastery map", pressed: true })).toBeTruthy();
  const node = await screen.findByRole("button", {
    name: "Loops, 2 of 3 complete, 67% mastery, in progress, average 2.5 of 3 stars, weak spot logic errors",
  });
  fireEvent.click(node);
  expect(mocks.push).toHaveBeenLastCalledWith("/quests?concept=Loops", { scroll: false });
  mocks.params = new URLSearchParams("concept=Loops");
  rerender(<QuestsPage />);
  expect(screen.getByRole("heading", { name: "Repeat a step" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Loops in a different concept" })).toBeNull();
  const search = screen.getByRole("searchbox");
  expect(document.activeElement).toBe(search);
  expect((search as HTMLInputElement).value).toBe("Loops");
  // The URL still holds the concept until the router replaces it; typed text must not be lost meanwhile.
  fireEvent.change(search, { target: { value: "Loopsx" } });
  expect((search as HTMLInputElement).value).toBe("Loopsx");
  expect(mocks.push).toHaveBeenLastCalledWith("/quests", { scroll: false });
  fireEvent.change(search, { target: { value: "" } });
  mocks.params = new URLSearchParams();
  rerender(<QuestsPage />);
  expect(screen.getByRole("heading", { name: "Loops in a different concept" })).toBeTruthy();
});

it("opens a bookmarked mastery map and shows an empty track", async () => {
  mocks.params = new URLSearchParams("view=map");
  mocks.api.mockImplementation(async (path: string) => path === "/quests" ? [] : { track: "python", concepts: [] });
  render(<QuestsPage />);
  expect(await screen.findByRole("heading", { name: "No concepts yet" })).toBeTruthy();
});
