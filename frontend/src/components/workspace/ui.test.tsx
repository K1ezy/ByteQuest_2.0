import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmDialog, Notice, SearchField } from "./ui";

afterEach(cleanup);

it("announces errors and lets the user dismiss them", () => {
  const dismiss = vi.fn();
  render(<Notice tone="error" onDismiss={dismiss}>Could not save. Your entries are still here.</Notice>);
  const alert = screen.getByRole("alert");
  expect(alert.getAttribute("aria-live")).toBe("assertive");
  expect(alert.textContent).toContain("Your entries are still here.");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
  expect(dismiss).toHaveBeenCalledOnce();
});

it("searches only when submitted and preserves the typed query", () => {
  const change = vi.fn();
  const submit = vi.fn();
  render(<SearchField value="loops" onChange={change} onSubmit={submit} label="Search courses" />);
  const input = screen.getByRole("searchbox", { name: "Search courses" });
  expect((input as HTMLInputElement).value).toBe("loops");
  fireEvent.change(input, { target: { value: "functions" } });
  expect(change).toHaveBeenCalledWith("functions");
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(submit).toHaveBeenCalledOnce();
});

it("keeps keyboard focus in a confirmation dialog and closes on Escape", async () => {
  const cancel = vi.fn();
  const confirm = vi.fn();
  const trigger = document.createElement("button");
  trigger.textContent = "Open";
  document.body.appendChild(trigger);
  trigger.focus();
  const view = render(<ConfirmDialog open title="Archive material" confirmLabel="Archive" onCancel={cancel} onConfirm={confirm}>Students keep their past results.</ConfirmDialog>);
  const dialog = screen.getByRole("dialog", { name: "Archive material" });
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(screen.getByText("Students keep their past results.")).toBeTruthy();
  await vi.waitFor(() => expect(document.activeElement?.textContent).toBe("Cancel"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(cancel).toHaveBeenCalledOnce();
  expect(confirm).not.toHaveBeenCalled();
  view.unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
