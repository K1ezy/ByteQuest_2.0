import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(), reload: vi.fn(), refreshCourses: vi.fn(),
  updateCourse: vi.fn(), getCourseImpact: vi.fn(), setCourseArchived: vi.fn(),
}));
vi.mock("@/components/workspace/ui", async orig => ({ ...await orig<typeof import("@/components/workspace/ui")>(), useApi: mocks.useApi }));
vi.mock("@/components/workspace/workspace-provider", () => ({
  useWorkspace: () => ({ refreshCourses: mocks.refreshCourses }),
  WorkspaceSuspense: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/workspace", async orig => ({
  ...await orig<typeof import("@/lib/workspace")>(),
  updateCourse: mocks.updateCourse, getCourseImpact: mocks.getCourseImpact, setCourseArchived: mocks.setCourseArchived,
}));

import Page from "./page";

const active = { id: "py", code: "PY", title: "Python Track", description: "Year 4", status: "active", student_count: 64, instructor_count: 2 };
const archived = { id: "old", code: "OLD", title: "Old Track", description: null, status: "archived" };

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.refreshCourses.mockResolvedValue(undefined);
  mocks.useApi.mockReturnValue({ data: { courses: [active, archived] }, reload: mocks.reload, loading: false });
});
afterEach(cleanup);

it("hides archived courses until asked, then offers only Restore for them", () => {
  render(<Page />);
  expect(screen.queryByText(/OLD · Old Track/)).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "Show archived (1)" }));
  expect(screen.getByText(/OLD · Old Track/)).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Course access" }).getAttribute("href")).toBe("/admin/assignments?course=py");
});

it("edits the title and description, never the code", async () => {
  mocks.updateCourse.mockResolvedValue({ message: "Course saved." });
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Course title"), { target: { value: "  Intermediate Programming  " } });
  fireEvent.click(screen.getByRole("button", { name: "Save course" }));
  await waitFor(() => expect(mocks.updateCourse).toHaveBeenCalledWith("py", { title: "Intermediate Programming", description: "Year 4" }));
  expect(await screen.findByText("Course saved.")).toBeTruthy();
  expect(mocks.reload).toHaveBeenCalled();
});

it("shows the impact before archiving and refuses while an exam is open or scheduled", async () => {
  mocks.getCourseImpact.mockResolvedValueOnce({ course: active, students: 64, instructors: 2, published_activities: 11,
    blocking_exams: [{ id: "e", title: "Midterm", opens_at: "2026-11-30T02:00:00Z", closes_at: "2026-11-30T03:00:00Z" }] });
  const view = render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  expect(await screen.findByText(/can't be archived yet/)).toBeTruthy();
  expect(screen.getByText(/Midterm · closes/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Archive course" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  view.unmount();

  mocks.getCourseImpact.mockResolvedValueOnce({ course: active, students: 64, instructors: 2, published_activities: 11, blocking_exams: [] });
  mocks.setCourseArchived.mockResolvedValue({ status: "archived", message: "Python Track is archived." });
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  expect(await screen.findByText(/affects 64 students, 2 instructors and 11 published activities/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Archive course" }));
  await waitFor(() => expect(mocks.setCourseArchived).toHaveBeenCalledWith("py", true));
  expect(await screen.findByText("Python Track is archived.")).toBeTruthy();
});
