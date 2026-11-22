import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Gradebook, gradebookCsv, type GradebookResponse } from "./gradebook";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("@/lib/api")>(),
  apiRequest: request,
}));
afterEach(() => { cleanup(); request.mockReset(); });

it("exports one row per learner with best scores, quoting commas and quotes", () => {
  const book: GradebookResponse = {
    course: { id: "c", code: "CS1", title: "Intro" },
    stuck_after_attempts: 3,
    activities: [
      { activity_id: "a1", title: 'Loops, "part 1"', activity_type: "challenge", attempted: 1, passed: 1 },
      { activity_id: "a2", title: "Quiz", activity_type: "quiz", attempted: 0, passed: 0 },
    ],
    students: [{
      student_id: "s1", pseudonym: "stu_x", username: "ana", display_name: "Ana Cruz", passed_count: 1, stuck_count: 0,
      cells: { a1: { attempts: 2, best_score: 66.7, passed: true, stuck: false } },
    }],
  };
  expect(gradebookCsv(book).split("\r\n")).toEqual([
    '"Learner","Username","Loops, ""part 1""","Quiz","Passed","Activities"',
    '"Ana Cruz","ana","66.7","","1","2"',
  ]);
});

it("neutralizes each formula prefix before escaping text cells", () => {
  const prefixes = ["=", "+", "-", "@", "\t", "\r"];
  const book: GradebookResponse = {
    course: { id: "c", code: "CS1", title: "Intro" }, stuck_after_attempts: 3,
    activities: prefixes.map((prefix) => ({
      activity_id: prefix, title: `${prefix}label, "quoted"`, activity_type: "quiz", attempted: 0, passed: 0,
    })),
    students: [{ ...learner("Sample student"), username: "@example" }],
  };
  const [headers, row] = gradebookCsv(book).split("\r\n");
  for (const prefix of prefixes) expect(headers).toContain(`"'${prefix}label, ""quoted"""`);
  expect(row).toContain(`"'@example"`);
});

function learner(displayName: string): GradebookResponse["students"][number] {
  return {
    student_id: "student", pseudonym: "stu_x", username: "student", display_name: displayName,
    passed_count: 0, stuck_count: 0, cells: {},
  };
}

function courseBook(id: string, name: string): GradebookResponse {
  return {
    course: { id, code: id, title: id }, stuck_after_attempts: 3,
    activities: [{ activity_id: "a", title: "Loops", activity_type: "quiz", attempted: 0, passed: 0 }],
    students: [learner(name)],
  };
}

it("clears the previous course, aborts old requests, and enables CSV only for a successful current result", async () => {
  let resolveSlowCourse!: (book: GradebookResponse) => void;
  const slowCourse = new Promise<GradebookResponse>((resolve) => { resolveSlowCourse = resolve; });
  request.mockResolvedValueOnce(courseBook("a", "First learner"))
    .mockReturnValueOnce(slowCourse)
    .mockRejectedValueOnce(new Error("Network issue"))
    .mockResolvedValueOnce(courseBook("c", "Current learner"));
  const noop = () => {};
  const { rerender } = render(<Gradebook courseId="a" onOpenStudent={noop} />);
  await screen.findByText("First learner");
  const exportButton = () => screen.getByRole<HTMLButtonElement>("button", { name: "Download CSV" });
  expect(exportButton().disabled).toBe(false);
  const scoreRegion = screen.getByRole("region", { name: "Gradebook scores" });
  expect(scoreRegion.tabIndex).toBe(0);
  expect(scoreRegion.querySelector("table")?.classList.contains("gradebook-table")).toBe(true);

  rerender(<Gradebook courseId="b" onOpenStudent={noop} />);
  expect(screen.queryByText("First learner")).toBeNull();
  expect(screen.getByRole("status", { name: "Loading gradebook" })).toBeTruthy();
  expect(exportButton().disabled).toBe(true);
  const signal = request.mock.calls[1][1].signal as AbortSignal;
  expect(signal.aborted).toBe(false);

  rerender(<Gradebook courseId="c" onOpenStudent={noop} />);
  expect(signal.aborted).toBe(true);
  await screen.findByRole("button", { name: "Retry" });
  await act(async () => resolveSlowCourse(courseBook("b", "Late learner")));
  expect(screen.queryByText("Late learner")).toBeNull();
  expect(exportButton().disabled).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByText("Current learner");
  expect(exportButton().disabled).toBe(false);
});
