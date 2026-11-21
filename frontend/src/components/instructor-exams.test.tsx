import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import InstructorExamsPage from "./instructor-exams";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/components/app-shell", () => ({ useShellProfile: () => ({ role: "instructor" }) }));
vi.mock("@/lib/api", async (original) => ({
  ...await original<typeof import("@/lib/api")>(),
  apiRequest: request,
}));

const workshops = [
  { id: "python-a", name: "Python A", language: "python" },
  { id: "python-b", name: "Python B", language: "python" },
  { id: "java-a", name: "Java A", language: "java" },
  { id: "cpp-a", name: "C++ A", language: "cpp" },
];
const activities = [
  { id: "loops", title: "Loops", language: "python", kind: "quiz" },
  { id: "strings", title: "Strings", language: "python", kind: "challenge" },
  { id: "numbers", title: "Numbers", language: "java", kind: "challenge" },
];

function serveCatalog(catalog: { workshops: typeof workshops; activities: (typeof activities[number] & { exam_only?: boolean })[] }) {
  request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/exams/instructor/catalog") return catalog;
    if (path === "/exams/instructor" && init?.method === "POST") return { id: "exam" };
    if (path === "/exams/instructor/exam/publish") return {};
    if (path === "/exams/instructor") return [];
    throw new Error(`Unexpected request to ${path}`);
  });
}

afterEach(() => { cleanup(); request.mockReset(); });

it("links to both setup prerequisites when the exam catalog is empty", async () => {
  serveCatalog({ workshops: [], activities: [] });
  render(<InstructorExamsPage />);
  expect((await screen.findByRole("link", { name: "Create a workshop" })).getAttribute("href")).toBe("/workshops");
  expect(screen.getByRole("link", { name: "Publish an activity" }).getAttribute("href")).toBe("/instructor/activities");
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Create and publish exam" }).disabled).toBe(true);
});

it("restricts workshops and activity choices to one track and clears items before switching", async () => {
  serveCatalog({ workshops, activities });
  render(<InstructorExamsPage />);
  await screen.findByText("Select a workshop to see its eligible activities.");
  const group = (name: RegExp) => screen.getByRole<HTMLInputElement>("checkbox", { name });
  fireEvent.click(group(/Python A/));
  expect(group(/Java A/).disabled).toBe(true);
  expect(group(/Python B/).disabled).toBe(false);
  fireEvent.click(group(/Loops/));
  fireEvent.click(group(/Python B/));
  fireEvent.click(group(/Python A/));
  expect(group(/Loops/).checked).toBe(true);
  fireEvent.click(group(/Python B/));

  fireEvent.click(group(/C\+\+ A/));
  expect(screen.getByRole("link", { name: "Publish an activity" }).getAttribute("href")).toBe("/instructor/activities");
  expect(screen.queryByRole("checkbox", { name: /Loops/ })).toBeNull();
  fireEvent.click(group(/C\+\+ A/));
  fireEvent.click(group(/Java A/));
  expect(group(/Numbers/).checked).toBe(false);
  fireEvent.click(group(/Java A/));
  fireEvent.click(group(/Python A/));
  expect(group(/Loops/).checked).toBe(false);
});

it("publishes eligible items in selection order with the assigned points", async () => {
  serveCatalog({ workshops, activities });
  render(<InstructorExamsPage />);
  fireEvent.click(await screen.findByRole("checkbox", { name: /Python A/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Python B/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Strings/ }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Points" }), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Loops/ }));
  fireEvent.change(screen.getByLabelText("Exam title"), { target: { value: "Term exam" } });
  fireEvent.change(screen.getByLabelText(/Opens · Manila/), { target: { value: "2027-01-09T09:00" } });
  fireEvent.change(screen.getByLabelText(/Closes · Manila/), { target: { value: "2027-01-09T10:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Create and publish exam" }));
  await screen.findByText("Exam published with a frozen copy of the reviewed activities.");

  const [, init] = request.mock.calls.find(([, init]) => init?.method === "POST") ?? [];
  expect(JSON.parse(String(init?.body))).toMatchObject({
    workshop_ids: ["python-a", "python-b"],
    items: [{ activity_id: "strings", points: 20 }, { activity_id: "loops", points: 10 }],
    opens_at: "2027-01-09T01:00:00.000Z",
  });
  expect(request).toHaveBeenCalledWith("/exams/instructor/exam/publish", { method: "POST" });
});

it("shows only exam-only content in restricted assessments", async () => {
  serveCatalog({ workshops, activities: [...activities,
    { id: "private", title: "Private loops", language: "python", kind: "quiz", exam_only: true }] });
  render(<InstructorExamsPage />);
  fireEvent.click(await screen.findByRole("checkbox", { name: /Python A/ }));
  expect(screen.queryByRole("checkbox", { name: /Private loops/ })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: /^Loops/ }));
  fireEvent.change(screen.getByLabelText("Exam type"), { target: { value: "restricted" } });
  expect(screen.queryByRole("checkbox", { name: /^Loops/ })).toBeNull();
  expect(screen.getByRole("checkbox", { name: /Private loops/ })).toBeDefined();
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Create and publish exam" }).disabled).toBe(true);
});
