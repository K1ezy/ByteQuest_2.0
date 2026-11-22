import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { CourseAnnouncements } from "./course-announcements";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (loadOriginal) => ({
  ...await loadOriginal<typeof import("@/lib/api")>(),
  apiRequest: request,
}));
afterEach(() => { cleanup(); request.mockReset(); });

it("focuses the first invalid field without sending an announcement", async () => {
  request.mockResolvedValue({ items: [], limit: 50 });
  render(<CourseAnnouncements courseId="course" />);
  await screen.findByText("No announcements yet.");
  fireEvent.click(screen.getByRole("button", { name: "New announcement" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Post announcement" }));
  const title = dialog.getByRole("textbox", { name: "Title" });
  expect(title.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(title);
  expect(dialog.getByText("Enter a message from 1 to 2,000 characters.")).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(1);
});

it("posts trimmed plain text and refreshes the selected course", async () => {
  request.mockResolvedValueOnce({ items: [], limit: 50 }).mockResolvedValueOnce({ id: "notice" })
    .mockResolvedValueOnce({ items: [{
      id: "notice", title: "Lab", body: "<b>Bring it</b>", pinned: true, expired: false,
      expires_at: null, created_at: "2026-11-15T16:00:00Z",
    }], limit: 50 });
  render(<CourseAnnouncements courseId="course" />);
  await screen.findByText("No announcements yet.");
  fireEvent.click(screen.getByRole("button", { name: "New announcement" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "  Lab  " } });
  fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "<b>Bring it</b>" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Pin to the top" }));
  fireEvent.click(screen.getByRole("button", { name: "Post announcement" }));
  expect(await screen.findByText("Announcement posted.")).toBeTruthy();
  expect(await screen.findByText("<b>Bring it</b>")).toBeTruthy();
  expect(request.mock.calls[1][0]).toBe("/faculty/announcements");
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
    course_id: "course", title: "Lab", body: "<b>Bring it</b>", pinned: true, expires_at: null,
  });
  expect(request.mock.calls[2][0]).toBe("/faculty/announcements?course_id=course");
});

it("keeps announcement edits on conflict and offers a manual copy when the clipboard is unavailable", async () => {
  const item = {
    id: "notice", title: "Lab", body: "Original text", pinned: false, expired: false,
    expires_at: null, created_at: "2026-11-15T16:00:00Z", updated_at: "2026-11-15T16:00:00Z",
  };
  request.mockResolvedValueOnce({ items: [item], limit: 50 })
    .mockRejectedValueOnce(new ApiError("Stale version", 409, "version_conflict"))
    .mockResolvedValueOnce({ items: [{ ...item, body: "Saved elsewhere" }], limit: 50 });
  render(<CourseAnnouncements courseId="course" />);
  await screen.findByText("Original text");
  fireEvent.click(screen.getByRole("button", { name: /^Edit/ }));
  const dialog = within(screen.getByRole("dialog"));
  const input = dialog.getByRole<HTMLTextAreaElement>("textbox", { name: "Message" });
  fireEvent.change(input, { target: { value: "My unsaved text" } });
  fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
  await dialog.findByText(/This was changed somewhere else/);
  expect(input.value).toBe("My unsaved text");
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
    body: "My unsaved text", expected_updated_at: item.updated_at,
  });
  fireEvent.click(dialog.getByRole("button", { name: "Copy my unsaved changes" }));
  const copy = await dialog.findByRole<HTMLTextAreaElement>("textbox", { name: "Unsaved changes to copy" });
  expect(JSON.parse(copy.value).body).toBe("My unsaved text");
  fireEvent.click(dialog.getByRole("button", { name: "Reload saved version" }));
  await screen.findByText("Saved elsewhere");
  expect(screen.queryByRole("dialog")).toBeNull();
});
