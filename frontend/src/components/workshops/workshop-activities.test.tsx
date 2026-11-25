import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Workshop } from "@/lib/types";

const mocks = vi.hoisted(() => ({ api: vi.fn(), update: vi.fn() }));
vi.mock("@/components/app-shell", () => ({
  useShellProfile: () => ({ role: "instructor", enrolled_language: "python" }),
}));
vi.mock("./workshop-layout", () => ({ useWorkshop: () => ({ workshop, setWorkshop: mocks.update }) }));
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("@/lib/api")>(), apiRequest: mocks.api,
}));

import { WorkshopActivities } from "./workshop-activities";

const workshop: Workshop = {
  id: "w", name: "Python practice", description: null, language: "python", is_owner: true,
  owned_by_me: true, join_code: "ABCD2345", joining_enabled: true, archived: false, owner_name: "Nora",
  member_count: 1, activity_ids: ["a", "b"],
  activities: ["a", "b"].map((id, position) => ({ activity_id: id, topic: "Loops", position, added_at: "" })),
};
const quests = workshop.activity_ids.map((id) => ({
  id, title: id === "a" ? "Repeat" : "Iterate", activity_type: "challenge", language: "python", topic_concept: "Loops",
  difficulty_level: 1, sequence_order: 1, added_at: "", added_at_estimated: false, xp_reward: 20, problem_statement: null,
  starter_code: null, is_completed: false, can_open: false, opens_at: null,
}));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it("groups activity cards and reorders with a button", async () => {
  mocks.api.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === "PATCH" ? workshop : quests);
  render(<WorkshopActivities />);
  expect(await screen.findByRole("heading", { name: "Loops" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Repeat" })).toBeTruthy();
  fireEvent.click(screen.getByText("Add", { selector: "summary" }));
  expect(screen.queryByRole("link", { name: "Exam" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Move Iterate up" }));
  await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledWith(workshop));
  expect(mocks.api).toHaveBeenCalledWith("/workshops/w/activities/b", { method: "PATCH", body: '{"position":0}' });
});
