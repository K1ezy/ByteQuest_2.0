import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { UserRole, Workshop } from "@/lib/types";

const mocks = vi.hoisted(() => ({ api: vi.fn(), push: vi.fn(), replace: vi.fn(), role: "student" as UserRole }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("@/lib/api")>(), apiRequest: mocks.api,
}));
vi.mock("@/components/app-shell", () => ({
  useShellProfile: () => ({ role: mocks.role, username: "learner", enrolled_language: "python" }),
}));

import { JoinWorkshopForm, WorkshopHome } from "./workshop-home";

const item: Workshop = {
  id: "workshop-1", name: "Python practice", description: null, language: "python", is_owner: false,
  owned_by_me: false, join_code: null, joining_enabled: true, archived: false, owner_name: "Nora",
  member_count: 2, activity_ids: [], activities: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "student";
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(cleanup);

it("shows the signed-in track and joins with the entered code", async () => {
  mocks.api.mockImplementation(async (path: string) => path === "/workshops/join" ? item : []);
  render(<WorkshopHome />);
  await screen.findByRole("heading", { name: "No workshops yet" });
  expect(screen.queryByRole("button", { name: "Create Workshop" })).toBeNull();
  const trigger = screen.getByRole("button", { name: "Join Workshop" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByText("Signed in as")).toBeTruthy();
  expect(screen.getByText("@learner")).toBeTruthy();
  expect(screen.getByText("Python track")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByLabelText("Workshop code"));
  fireEvent.change(screen.getByLabelText("Workshop code"), { target: { value: "abcd-2345" } });
  fireEvent.submit(screen.getByLabelText("Workshop code").closest("form")!);
  await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/workshops/workshop-1"));
  expect(mocks.api).toHaveBeenCalledWith("/workshops/join", { method: "POST", body: '{"code":"ABCD2345"}' });
  expect(document.activeElement).toBe(trigger);
});

it("checks the code locally before using the join endpoint", async () => {
  render(<JoinWorkshopForm />);
  const field = screen.getByRole("textbox", { name: "Workshop code" });
  fireEvent.change(field, { target: { value: "ABCDEFG!" } });
  fireEvent.submit(field.closest("form")!);
  expect((await screen.findByRole("alert")).textContent).toContain("8 letters or numbers");
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(mocks.api).not.toHaveBeenCalled();
});

it("creates a workshop with the selected language and classroom details", async () => {
  mocks.role = "instructor";
  mocks.api.mockImplementation(async (_path: string, options?: RequestInit) => options?.method === "POST" ? item : []);
  render(<WorkshopHome />);
  await screen.findByRole("heading", { name: "No workshops yet" });
  fireEvent.click(screen.getByRole("button", { name: "Create Workshop" }));
  const dialog = within(screen.getByRole("dialog", { name: "Create Workshop" }));
  // Staff choose the language on purpose; their own profile track is not a default.
  expect(dialog.getAllByRole<HTMLInputElement>("radio").some((radio) => radio.checked)).toBe(false);
  fireEvent.click(dialog.getByRole("radio", { name: "Java" }));
  fireEvent.change(dialog.getByRole("textbox", { name: "Workshop name" }), { target: { value: "  Java practice  " } });
  fireEvent.change(dialog.getByRole("textbox", { name: "Block" }), { target: { value: "3CS-A" } });
  fireEvent.change(dialog.getByRole("combobox", { name: "Year level" }), { target: { value: "3" } });
  fireEvent.change(dialog.getByRole("textbox", { name: "Subject" }), { target: { value: "  Programming 101  " } });
  fireEvent.change(dialog.getByRole("textbox", { name: "Room" }), { target: { value: "501" } });
  fireEvent.click(dialog.getByRole("button", { name: "Create Workshop" }));
  await vi.waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/workshops/workshop-1"));
  expect(mocks.api).toHaveBeenCalledWith("/workshops", {
    method: "POST", body: '{"name":"Java practice","language":"java","block":"3CS-A","year_level":3,"subject":"Programming 101","room":"501"}',
  });
});

it("requires confirmation before trying an invite and keeps the code visible after refusal", async () => {
  mocks.api.mockRejectedValueOnce(new Error("This workshop isn't accepting new members."));
  render(<JoinWorkshopForm code="ABCD2345" />);
  expect(mocks.api).not.toHaveBeenCalled();
  const field = screen.getByLabelText<HTMLInputElement>("Workshop code");
  fireEvent.submit(field.closest("form")!);
  expect((await screen.findByRole("alert")).textContent).toContain("isn't accepting new members");
  expect(field.value).toBe("ABCD2345");
  expect(mocks.replace).not.toHaveBeenCalled();
});

it("switches an instructor between active and archived lists", async () => {
  mocks.role = "instructor";
  mocks.api.mockImplementation(async (path: string) => path.endsWith("archived=true")
    ? [{ ...item, name: "Past workshop", archived: true }]
    : [{ ...item, owned_by_me: true, is_owner: true, subject: "Programming 101", room: "501" }]);
  render(<WorkshopHome />);
  expect(await screen.findByRole("heading", { name: "Teaching" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /Python practice/ })).toBeTruthy();
  expect(screen.getByText("Programming 101 · Room 501")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Archived" }));
  expect(await screen.findByRole("link", { name: /Past workshop/ })).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Python practice/ })).toBeNull();
});
