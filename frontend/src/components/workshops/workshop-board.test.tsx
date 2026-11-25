import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Workshop } from "@/lib/types";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/components/app-shell", () => ({ useShellProfile: () => ({ role: "student" }) }));
vi.mock("./workshop-layout", () => ({ useWorkshop: () => ({ workshop }) }));
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("@/lib/api")>(), apiRequest: mocks.api,
}));

import { WorkshopBoard } from "./workshop-board";

const workshop: Workshop = {
  id: "w", name: "Python practice", description: null, language: "python", is_owner: true,
  owned_by_me: true, join_code: null, joining_enabled: true, archived: false, owner_name: "Nora",
  member_count: 1, activity_ids: [], activities: [],
};
const item = { id: "post", body: "Bring your loop exercise.", pinned: false, created_at: "2026-11-21T01:00:00Z", updated_at: "2026-11-21T01:00:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  workshop.archived = false;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(cleanup);

it("posts and pins an announcement from the Board", async () => {
  mocks.api.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === "POST" ? item
    : init?.method === "PATCH" ? { ...item, pinned: true } : []);
  render(<WorkshopBoard />);
  await screen.findByText("No announcements yet.");
  fireEvent.click(screen.getByRole("button", { name: "Post announcement" }));
  fireEvent.change(screen.getByLabelText("Announcement"), { target: { value: item.body } });
  fireEvent.click(screen.getByRole("button", { name: "Post" }));
  expect(await screen.findByText(item.body)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Pin" }));
  expect(await screen.findByText("Pinned")).toBeTruthy();
  expect(mocks.api).toHaveBeenCalledWith("/workshops/w/announcements/post", { method: "PATCH", body: '{"pinned":true}' });
});

it("keeps posts and upcoming practice visible in an archived workshop", async () => {
  workshop.archived = true;
  mocks.api.mockImplementation(async (path: string) => path.endsWith("/upcoming")
    ? [{ id: "challenge", title: "Loops practice", kind: "challenge", closes_at: "2026-11-21T02:00:00Z" }]
    : [item]);
  render(<WorkshopBoard />);
  expect(await screen.findByText(item.body)).toBeTruthy();
  expect((await screen.findByRole("link", { name: "Loops practice" })).getAttribute("href")).toBe("/workshops/w/activities");
  expect(screen.queryByRole("button", { name: "Post announcement" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
});
