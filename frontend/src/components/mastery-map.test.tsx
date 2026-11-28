import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(), apiRequest: mocks.api,
}));

import { MasteryMap } from "./mastery-map";

afterEach(() => { cleanup(); mocks.api.mockReset(); });

const concept = { total: 1, completed: 0, mastery_percent: 0, state: "not_started", average_stars: null,
  weak_spot: null, activity_ids: ["a"] };

it("keeps the same concept separate per language, labels it, and filters by language", async () => {
  mocks.api.mockResolvedValue({ languages: ["java", "python"], concepts: [
    { ...concept, language: "python", concept: "Loops", completed: 1, mastery_percent: 100, state: "mastered" },
    { ...concept, language: "java", concept: "Loops" },
  ] });
  render(<MasteryMap />);
  const python = await screen.findByRole("link", { name: /Loops in Python, 1 of 1 complete/ });
  const java = screen.getByRole("link", { name: /Loops in Java, 0 of 1 complete/ });
  expect(java.getAttribute("href")).toBe("/quests?concept=Loops&language=java");
  expect(python).toBeTruthy();
  expect(screen.getAllByText("0% of its activities passed").length).toBe(1);

  fireEvent.click(within(screen.getByRole("group", { name: "Language" })).getByRole("button", { name: "Java" }));
  expect(screen.queryByRole("link", { name: /Loops in Python/ })).toBeNull();
  expect(screen.getByRole("link", { name: /Loops in Java/ })).toBeTruthy();
});
