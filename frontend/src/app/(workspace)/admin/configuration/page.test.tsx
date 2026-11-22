import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ useApi: vi.fn(), reload: vi.fn(), updateSetting: vi.fn() }));
vi.mock("@/components/workspace/workspace-provider", () => ({
  WorkspaceSuspense: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/workspace/ui", async orig => ({ ...await orig<typeof import("@/components/workspace/ui")>(), useApi: mocks.useApi }));
vi.mock("@/lib/workspace", async orig => ({ ...await orig<typeof import("@/lib/workspace")>(), updateSetting: mocks.updateSetting }));

import Page from "./page";

const setting = (key: string, label: string, value: number) => ({
  key, label, description: `${label} description`, value, value_type: "integer", min_value: 1, max_value: 10,
  version: 2, last_editor: null, updated_at: null, service: "processing", service_label: "Processing",
});

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.useApi.mockReturnValue({ reload: mocks.reload, loading: false, data: { total: 2, groups: [{ service: "processing", label: "Processing",
    settings: [setting("job_retry_limit", "Job retry limit", 3), setting("upload_limit", "Upload limit", 5)] }] } });
});
afterEach(cleanup);

it("edits a setting right under its own row", () => {
  render(<Page />);
  const rows = screen.getAllByRole("listitem");
  fireEvent.click(within(rows[1]).getByRole("button", { name: "Change" }));
  expect(within(rows[1]).getByLabelText("New value for Upload limit")).toBeTruthy();
  expect(within(rows[0]).queryByRole("textbox")).toBeNull();
});

it("after saving, shows what changed on the row and links to its audit entry", async () => {
  mocks.updateSetting.mockResolvedValue({ message: "Saved.", setting: { ...setting("job_retry_limit", "Job retry limit", 4), version: 3 } });
  render(<Page />);
  const row = screen.getAllByRole("listitem")[0];
  fireEvent.click(within(row).getByRole("button", { name: "Change" }));
  fireEvent.change(within(row).getByLabelText("New value for Job retry limit"), { target: { value: "4" } });
  fireEvent.click(within(row).getByRole("button", { name: "Review change" }));
  fireEvent.click(screen.getByRole("button", { name: "Save setting" }));
  await waitFor(() => expect(mocks.updateSetting).toHaveBeenCalledWith("job_retry_limit", 4, 2));
  const note = await within(row).findByRole("status");
  expect(note.textContent).toContain("changed from 3 to 4 (version 3)");
  expect(within(note).getByRole("link").getAttribute("href")).toBe("/admin/monitoring?audit=Job%20retry%20limit");
});

it("does not offer to save a value that is already saved", () => {
  render(<Page />);
  const row = screen.getAllByRole("listitem")[0];
  fireEvent.click(within(row).getByRole("button", { name: "Change" }));
  fireEvent.click(within(row).getByRole("button", { name: "Review change" }));
  expect(within(row).getByText("Enter a different value. This one is already saved.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save setting" })).toBeNull();
});

it("keeps an out-of-range value from reaching review", () => {
  render(<Page />);
  const row = screen.getAllByRole("listitem")[0];
  fireEvent.click(within(row).getByRole("button", { name: "Change" }));
  fireEvent.change(within(row).getByLabelText("New value for Job retry limit"), { target: { value: "99" } });
  fireEvent.click(within(row).getByRole("button", { name: "Review change" }));
  expect(within(row).getByText("Enter at most 10.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save setting" })).toBeNull();
});
