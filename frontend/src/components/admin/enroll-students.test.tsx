import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EnrollStudents } from "./enroll-students";
import type { EnrollmentPlan } from "@/lib/workspace";

const submit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/workspace", async orig => ({ ...await orig<typeof import("@/lib/workspace")>(), submitEnrollment: submit }));
afterEach(() => { cleanup(); submit.mockReset(); });

const courses = [{ id: "py", code: "PY", title: "Python Track" }, { id: "js", code: "JS", title: "Web Track" }];
const plan: EnrollmentPlan = {
  will_enroll: [{ school_id: "26-41001", name: "4CS-A Student 01" }, { school_id: "26-41002", name: "4CS-A Student 02" }],
  already_enrolled: [{ school_id: "26-41003", name: "4CS-A Student 03" }],
  not_found: [{ school_id: "26-99999" }],
  not_eligible: [{ school_id: "26-50000", name: "Instructor", reason: "Not a student account" }],
  invalid: [{ school_id: "abc" }],
};

function setup(onEnrolled = vi.fn()) {
  render(<EnrollStudents courses={courses} initialCourse="py" onEnrolled={onEnrolled} onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("School IDs"), { target: { value: "26-41001 26-41002 26-41003 26-99999 26-50000 abc" } });
  return onEnrolled;
}

it("asks for IDs before previewing", () => {
  render(<EnrollStudents courses={courses} initialCourse="py" onEnrolled={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(screen.getByText("Paste at least one School ID.")).toBeTruthy();
  expect(submit).not.toHaveBeenCalled();
});

it("previews every group, then enrolls only after the confirm", async () => {
  const onEnrolled = setup();
  submit.mockResolvedValueOnce({ plan });
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(await screen.findByText("Will enroll")).toBeTruthy();
  expect(submit).toHaveBeenCalledWith("py", expect.stringContaining("26-41001"), "preview");
  for (const group of ["Already enrolled", "Not found", "Not a student, or deactivated", "Not a valid School ID"]) {
    expect(screen.getByText(group)).toBeTruthy();
  }
  expect(screen.getByText(/26-50000 · Instructor · Not a student account/)).toBeTruthy();

  submit.mockResolvedValueOnce({ plan, enrolled: 1, message: "Enrolled 1 student in Python Track." });
  fireEvent.click(screen.getByRole("button", { name: "Enroll 2 students" }));
  await waitFor(() => expect(onEnrolled).toHaveBeenCalledWith(
    "Enrolled 1 student in Python Track. 1 changed since the preview and were skipped."));
  expect(submit).toHaveBeenLastCalledWith("py", expect.any(String), "enroll");
});

it("blocks enrolling from a preview of a list that has since changed", async () => {
  setup();
  submit.mockResolvedValueOnce({ plan });
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  await screen.findByText("Will enroll");
  fireEvent.change(screen.getByLabelText("Course"), { target: { value: "js" } });
  expect(screen.getByText("The course or list changed. Preview again before enrolling.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Enroll 2 students" }) as HTMLButtonElement).disabled).toBe(true);
});
