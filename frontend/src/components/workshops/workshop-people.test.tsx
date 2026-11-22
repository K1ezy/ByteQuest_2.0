import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { UserRole, Workshop } from "@/lib/types";

const mocks = vi.hoisted(() => ({ api: vi.fn(), update: vi.fn(), replace: vi.fn(), role: "instructor" as UserRole }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/components/app-shell", () => ({ useShellProfile: () => ({ role: mocks.role }) }));
vi.mock("./workshop-layout", () => ({ useWorkshop: () => ({ workshop, setWorkshop: mocks.update }) }));
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("@/lib/api")>(), apiRequest: mocks.api,
}));

import { WorkshopPeople } from "./workshop-people";

const workshop: Workshop = {
  id: "w", name: "Python practice", description: null, language: "python", is_owner: true, owned_by_me: true,
  join_code: null, joining_enabled: true, archived: false, owner_name: "Nora", member_count: 2, activity_ids: [], activities: [],
};
const instructor = { username: "instructor" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "instructor";
  workshop.is_owner = true;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(cleanup);

it("requires confirmation to remove a student and preserves the row if an exam blocks removal", async () => {
  mocks.api.mockImplementation(async (_path: string, init?: RequestInit) => {
    if (init?.method === "DELETE") throw new Error("This student has an exam in progress for this workshop.");
    return { instructor, students: [{ id: "s", username: "learner", display_name: "Test Learner", school_id: "26-00001", year_level: 1, block_section: "B" }] };
  });
  render(<WorkshopPeople />);
  expect(await screen.findByText(/School ID 26-00001/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Remove @learner" }));
  expect(mocks.api.mock.calls).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Remove student" }));
  expect((await screen.findByRole("alert")).textContent).toContain("exam in progress");
  expect(screen.getByText("Test Learner")).toBeTruthy();
  expect(mocks.update).not.toHaveBeenCalled();
});

it("shows aliases to a student and returns home after confirmed leave", async () => {
  workshop.is_owner = false;
  mocks.role = "student";
  mocks.api.mockResolvedValueOnce({ instructor, students: [{ username: "classmate" }] }).mockResolvedValueOnce(null);
  render(<WorkshopPeople />);
  expect(await screen.findByText("@classmate")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Leave workshop" }));
  fireEvent.click(screen.getByRole("dialog").querySelector('button[type="submit"]')!);
  await vi.waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/workshops"));
  expect(mocks.api).toHaveBeenCalledWith("/workshops/w/membership", { method: "DELETE" });
});
