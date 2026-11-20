import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { StudentAnnouncements } from "./student-announcements";
import type { StudentAnnouncement } from "@/lib/workspace";

const now = new Date("2026-11-16T03:00:00Z");
const item: StudentAnnouncement = {
  id: "fixture", course_title: "Python", author_name: "Your instructor", title: "Lab reminder",
  body: "Bring headphones.\n<script>Text only</script>", pinned: true,
  expires_at: null, created_at: "2026-11-16T00:00:00Z",
};
afterEach(() => {
  cleanup();
  window.localStorage.removeItem("bytequest:announcement-dismissed:fixture");
});

it("hides when empty and filters a notice at its expiry time", () => {
  const { rerender } = render(<StudentAnnouncements items={[]} now={now} />);
  expect(screen.queryByRole("region", { name: "Announcements" })).toBeNull();
  rerender(<StudentAnnouncements items={[{ ...item, expires_at: now.toISOString() }]} now={now} />);
  expect(screen.queryByRole("region", { name: "Announcements" })).toBeNull();
});

it("renders plain text and remembers dismissal across visits", () => {
  const { unmount, container } = render(<StudentAnnouncements items={[item]} now={now} />);
  expect(screen.getByText("Pinned")).toBeTruthy();
  expect(container.querySelector(".announcement-list p.announcement-copy")?.textContent).toBe(item.body);
  expect(container.querySelector("script")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss Lab reminder" }));
  expect(screen.queryByRole("region", { name: "Announcements" })).toBeNull();
  unmount();
  render(<StudentAnnouncements items={[item]} now={now} />);
  expect(screen.queryByRole("heading", { name: "Lab reminder" })).toBeNull();
});
