import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Workshop } from "@/lib/types";

const mocks = vi.hoisted(() => ({ api: vi.fn(), update: vi.fn() }));
vi.mock("./workshop-layout", () => ({ useWorkshop: () => ({ workshop, setWorkshop: mocks.update }) }));
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("@/lib/api")>(), apiRequest: mocks.api,
}));

import { WorkshopSettings } from "./workshop-settings";

const workshop: Workshop = {
  id: "w", name: "Python practice", description: null, language: "python", is_owner: true,
  owned_by_me: true, join_code: "ABCD2345", joining_enabled: true, archived: false, owner_name: "Nora",
  member_count: 1, activity_ids: [], activities: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  workshop.archived = false;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(cleanup);

it("requires a confirmation before resetting the invite code", async () => {
  mocks.api.mockResolvedValueOnce({ ...workshop, join_code: "WXYZ2345" });
  render(<WorkshopSettings />);
  fireEvent.click(screen.getByRole("button", { name: "Reset code" }));
  expect(mocks.api).not.toHaveBeenCalled();
  const dialog = within(screen.getByRole("dialog", { name: "Reset workshop code?" }));
  fireEvent.click(dialog.getByRole("button", { name: "Reset code" }));
  expect((await screen.findByText("Workshop code reset.")).getAttribute("role")).toBe("status");
  expect(mocks.api).toHaveBeenCalledWith("/workshops/w/code", { method: "POST" });
  expect(mocks.update).toHaveBeenCalledWith({ ...workshop, join_code: "WXYZ2345" });
});

it("saves classroom details from Settings", async () => {
  mocks.api.mockResolvedValueOnce({ ...workshop, block: "3CS-B", year_level: 3, subject: "Programming 101" });
  render(<WorkshopSettings />);
  fireEvent.change(screen.getByRole("textbox", { name: "Block" }), { target: { value: "3CS-B" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Year level" }), { target: { value: "3" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Subject" }), { target: { value: "Programming 101" } });
  fireEvent.click(screen.getByRole("button", { name: "Save details" }));
  expect(await screen.findByText("Workshop details saved.")).toBeTruthy();
  expect(mocks.api).toHaveBeenCalledWith("/workshops/w", {
    method: "PATCH",
    body: '{"name":"Python practice","description":"","block":"3CS-B","year_level":3,"subject":"Programming 101","room":null}',
  });
});

it("presents restore as the only archived workshop mutation", async () => {
  workshop.archived = true;
  mocks.api.mockResolvedValueOnce({ ...workshop, archived: false });
  render(<WorkshopSettings />);
  expect(screen.queryByRole("button", { name: "Save details" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Reset code" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Disable joining" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Restore workshop" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restore workshop" }));
  await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ ...workshop, archived: false }));
  expect(mocks.api).toHaveBeenCalledWith("/workshops/w/restore", { method: "POST" });
});
