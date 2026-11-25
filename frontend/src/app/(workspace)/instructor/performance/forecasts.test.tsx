import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
  apiRequest: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams(),
  courseId: "coursealpha",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/instructor/performance",
  useSearchParams: () => mocks.params,
}));
vi.mock("@/components/workspace/workspace-provider", () => ({
  useWorkspace: () => ({ courseId: mocks.courseId }),
  WorkspaceSuspense: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/workspace/ui", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/workspace/ui")>();
  return { ...original, useApi: mocks.useApi };
});
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiRequest: mocks.apiRequest };
});

vi.mock("@/components/insights/plot", () => ({default: () => null}));
vi.mock("@/components/instructor/gradebook", () => ({Gradebook: () => null}));
vi.mock("@/lib/workspace", async (orig) => ({...await orig<typeof import("@/lib/workspace")>(), getStudentPerformance: async (id:string) => ({
  course:{title:"Python"}, student:{student_id:id,display_name:id==="studentbeta"?"Grace":"Ada",current_level:2,xp_points:30},
  progress:{completed:1,total:2,percent:50},attempts:[]})}));
import Page from "./page";

const forecast = {
  id: "forecastone",
  target_activity_id: "activityone",
  target_activity: "Next quiz",
  target_topic: "loops",
  probability: 0.72,
  label: "Likely to pass",
  predicted_pass: true,
  model_version: "v2.0.0",
  selected_model: "random_forest" as const,
  as_of: "2026-11-11T08:00:00Z",
  actual_outcome: null,
  advisory: "Advisory only; grades, rewards and access are unchanged.",
};

function student(overrides: Record<string, unknown> = {}) {
  return {
    student_id: "studentalpha",
    display_name: "Ada",
    username: "ada",
    average_score: 80,
    latest_score: 80,
    quiz_count: 1,
    challenge_count: 0,
    exam_count: 0,
    result_count: 1,
    forecast_status: "saved",
    forecast,
    target_activity: "Next quiz",
    target_activity_id: "activityone",
    target_topic: "loops",
    ...overrides,
  };
}

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    course: { id: "coursealpha", code: "CS1", title: "Python", status: "active" },
    period: "all",
    aggregation_timezone: "UTC",
    readiness: { status: "ready", forecasts_available: true, active_model_version: "v2.0.0" },
    summary: {
      active_learners: 1,
      graded_events: 1,
      average_score: 80,
      forecast_count: 1,
      forecast_denominator: 1,
      need_support: 0,
    },
    trend: [{ date: "2026-11-11", quiz: 80, challenge: null, exam: null }],
    thresholds: { support_below: 0.4, likely_at_or_above: 0.6, decision: 0.5 },
    students: [student()],
    ...overrides,
  };
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    course: { id: "coursealpha", code: "CS1", title: "Python", status: "active" },
    student: student(),
    history: [{ kind: "exam", title: "Midterm", score_percentage: 90, at: "2026-11-11T08:00:00Z" }],
    trend: [{ date: "2026-11-11", quiz: null, challenge: null, exam: 90 }],
    predictions: [{ ...forecast, is_current: true, from_active_model: true }],
    evidence: {
      topic: "loops",
      prior_tasks_attempted: 3,
      prior_tasks_required: 3,
      result_count: 1,
      period: "all",
    },
    ...overrides,
  };
}

function useApiReturning(data = dashboard(), error = "") {
  mocks.useApi.mockImplementation((path:string) => ({
    loading:false, error,reload:vi.fn(),data:path.includes("/faculty/ml?") ? data : {
      summary:{active_learners:data.students.length,published_activities:2,average_score:80,need_follow_up:0,average_completion_percent:50},
      activities:[],students:data.students.map(r => ({...r,pseudonym:r.student_id,enrolled_language:"python",attempt_count:1,completed_count:1,total_activities:2}))
    }
  }));
}
beforeEach(() => { mocks.params = new URLSearchParams(); });
afterEach(() => {cleanup(); vi.clearAllMocks();});

it("reports an unavailable model without implying nobody needs support", () => {
  useApiReturning(
    dashboard({
      readiness: {
        status: "artifacts_unavailable",
        forecasts_available: false,
        active_model_version: null,
      },
      summary: {
        active_learners: 1,
        graded_events: 2,
        average_score: 82,
        forecast_count: 0,
        forecast_denominator: 1,
        need_support: null,
      },
      students: [student({ forecast_status: "model_unavailable", forecast: null })],
    }),
  );
  render(<Page />);
  expect(screen.queryByRole("columnheader",{name:"Outlook"})).toBeNull();
  expect(screen.queryByLabelText("Outlook")).toBeNull();
  expect(screen.getByRole("link",{name:"Model evaluation"})).toBeTruthy();
  expect(screen.getByText(/No approved, active model/)).toBeTruthy();
  // The same advisory note appears wherever forecasts are mentioned.
  expect(screen.getByText(/Once it's on, an Outlook column appears/).textContent).toMatch(/advisory, for instructors only: students never see it/);
});

it("labels the average as activity history and states the aggregation timezone", () => {
  useApiReturning(dashboard());
  render(<Page />);
  expect(screen.getAllByText("Latest activity average").length).toBeGreaterThan(0);
  expect(screen.getByText(/daily averages in UTC/)).toBeTruthy();
  expect(screen.getByText(/Repeated attempts count as separate recorded results/)).toBeTruthy();
});

it("shows an empty enrollment state", () => {
  useApiReturning(
    dashboard({
      students: [],
      summary: {
        active_learners: 0,
        graded_events: 0,
        average_score: null,
        forecast_count: 0,
        forecast_denominator: 0,
        need_support: 0,
      },
      trend: [],
    }),
  );
  render(<Page />);
  expect(screen.getByText("No students enrolled yet")).toBeTruthy();
  expect(screen.getByText("No graded results in this period.")).toBeTruthy();
});

it("shows a loading state before course data arrives", () => {
  mocks.useApi.mockReturnValue({ loading: true, error: "", reload: vi.fn(), data: null });
  render(<Page />);
  expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
});

it("keeps same-course data visible with a stale notice when a refresh fails", () => {
  useApiReturning(dashboard(), "Network error");
  render(<Page/>);
  expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  expect(screen.getByText("Ada")).toBeTruthy();
});

it("describes a probability as an estimated chance, never as confidence", () => {
  useApiReturning(dashboard());
  render(<Page />);
  expect(screen.getByText(/72% estimated chance of passing/)).toBeTruthy();
  expect(screen.queryByText(/confidence/i)).toBeNull();
  expect(screen.queryByText(/guaranteed/i)).toBeNull();
});

it.each([
  [0.39, "May need support", "Review the relevant concept"],
  [0.4, "Continue practicing", "Encourage further practice"],
  [0.59, "Continue practicing", "Encourage further practice"],
  [0.6, "Likely to pass", "Review readiness for the existing next activity"],
])("maps a %s probability onto its advisory band and teaching action", async (probability, label, action) => {
  const banded = { ...forecast, probability: probability as number, label: label as string };
  useApiReturning(dashboard({ students: [student({ forecast: banded })] }));
  mocks.apiRequest.mockResolvedValue(detail({ student: student({ forecast: banded }) }));
  render(<Page />);
  expect(screen.getAllByText(label as string).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "View history" }));
  await waitFor(() => expect(screen.getByText(new RegExp(action as string))).toBeTruthy());
});

it("opens a learner drawer with evidence, advisory wording and forecast history", async () => {
  useApiReturning(dashboard());
  mocks.apiRequest.mockResolvedValue(detail());
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "View history" }));
  await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Forecast")).toBeTruthy());
  const drawer = screen.getByRole("dialog");
  expect(mocks.apiRequest).toHaveBeenCalledWith(
    expect.stringContaining("/faculty/ml/students/studentalpha?course_id=coursealpha&period=all"),
  );
  expect(within(drawer).queryByText(/Midterm/)).toBeNull();
  expect(within(drawer).getByText(/Random forest/)).toBeTruthy();
  expect(within(drawer).getByText("Pass")).toBeTruthy();
  expect(within(drawer).getByText(/grades, rewards and access are unchanged/)).toBeTruthy();
  expect(within(drawer).getByText(/3 of 3 earlier course activities attempted/)).toBeTruthy();
  expect(within(drawer).getByText(/not explanations of the model output/)).toBeTruthy();
  expect(within(drawer).getByText(/current forecast/)).toBeTruthy();
});

it("marks an older forecast from a superseded model as an earlier forecast", async () => {
  useApiReturning(dashboard());
  mocks.apiRequest.mockResolvedValue(
    detail({
      predictions: [
        { ...forecast, id: "old", model_version: "v1.0.0", is_current: false, from_active_model: false },
      ],
    }),
  );
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "View history" }));
  await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Forecast")).toBeTruthy());
  expect(screen.getByText(/earlier forecast \(not the active model\)/)).toBeTruthy();
});

it("restores focus to the opening row action when the drawer closes", async () => {
  useApiReturning(dashboard());
  mocks.apiRequest.mockResolvedValue(detail());
  render(<Page />);
  const open = screen.getByRole("button", { name: "View history" });
  open.focus();
  fireEvent.click(open);
  await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Forecast")).toBeTruthy());
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(open));
});

it("ignores a stale learner response that resolves after another learner opened", async () => {
  const rows = [student(), student({ student_id: "studentbeta", display_name: "Grace", username: "grace" })];
  useApiReturning(dashboard({ students: rows }));
  let resolveFirst: ((value: unknown) => void) | undefined;
  mocks.apiRequest
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
    .mockResolvedValueOnce(detail({ student: rows[1], history: [] }));
  render(<Page />);
  const buttons = screen.getAllByRole("button", { name: "View history" });
  fireEvent.click(buttons[0]);
  fireEvent.click(buttons[1]);
  resolveFirst?.(detail({ student: rows[0] }));
  await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Forecast")).toBeTruthy());
  expect(screen.getByRole("dialog").textContent).toContain("Grace");
  expect(screen.getByRole("dialog").textContent).not.toContain("Ada");
});

it("searches, filters, sorts and paginates the table without changing the summary", () => {
  const many = Array.from({ length: 30 }, (_, index) =>
    student({
      student_id: `student${index}`,
      display_name: `Learner ${String(index).padStart(2, "0")}`,
      username: `learner${index}`,
      latest_score: index,
      forecast: index === 0 ? { ...forecast, probability: 0.2, label: "May need support" } : null,
      forecast_status: index === 0 ? "saved" : "no_saved_prediction",
    }),
  );
  useApiReturning(
    dashboard({
      students: many,
      summary: {
        active_learners: 30,
        graded_events: 30,
        average_score: 80,
        forecast_count: 1,
        forecast_denominator: 30,
        need_support: 1,
      },
    }),
  );
  render(<Page />);
  expect(screen.getAllByRole("button",{name:"View history"})).toHaveLength(25);
  fireEvent.click(screen.getByRole("button",{name:"Next"}));
  expect(screen.getAllByRole("button",{name:"View history"})).toHaveLength(5);
  expect(screen.getByRole("option",{name:"May need support (1)"})).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Outlook"),{target:{value:"support"}});
  expect(screen.getAllByRole("button",{name:"View history"})).toHaveLength(1);
});

it("sorts missing numeric values last", () => {
  const rows = [
    student({ student_id: "a", display_name: "A", username: "a", latest_score: null, forecast: null, forecast_status: "no_graded_history" }),
    student({ student_id: "b", display_name: "B", username: "b", latest_score: 91 }),
  ];
  useApiReturning(dashboard({ students: rows }));
  render(<Page />);
  fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "latest" } });
  const names = within(screen.getByRole("table",{name:"Student performance for this course"})).getAllByRole("row").slice(1).map(row => within(row).getAllByText(/^[AB]$/)[0].textContent);
  expect(names).toEqual(["B", "A"]);
});

it("keeps the period in the URL and requests it from the API", () => {
  mocks.params = new URLSearchParams("period=30d");
  useApiReturning(dashboard({ period: "30d" }));
  render(<Page />);
  expect(mocks.useApi).toHaveBeenCalledWith(
    "/faculty/ml?course_id=coursealpha&period=30d", true,
  );
  fireEvent.change(screen.getByLabelText("Historical period"), { target: { value: "7d" } });
  expect(mocks.replace).toHaveBeenCalledWith(
    expect.stringContaining("period=7d"),
    expect.anything(),
  );
});

it("says the period never changes forecast eligibility", () => {
  useApiReturning(dashboard());
  render(<Page />);
  expect(
    screen.getByText(/never changes model inputs, the next activity, or whether a forecast is available/),
  ).toBeTruthy();
});
