import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock("@/components/workspace/workspace-provider", () => ({
  useWorkspace: () => ({ courseId: "coursealpha" }),
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

import Page from "./page";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("shows honest model readiness, released exam history and a student detail", async () => {
  mocks.useApi.mockReturnValue({
    loading: false, error: "", reload: vi.fn(), data: {
      course: { title: "Python" }, readiness: { status: "artifacts_unavailable" },
      summary: { active_learners: 1, graded_events: 2, average_score: 82, forecast_count: 0, need_support: 0 },
      trend: [{ date: "2026-11-11", quiz: 74, challenge: null, exam: 90 }],
      model_quality: { labeled_predictions: 0, accuracy_percent: null },
      students: [{ student_id: "studentalpha", display_name: "Ada", username: "ada",
        average_score: 82, latest_score: 90, quiz_count: 1, challenge_count: 0, exam_count: 1,
        forecast_status: "model_unavailable", forecast: null, target_activity: "Next quiz" }],
    },
  });
  mocks.apiRequest.mockResolvedValue({
    student: { display_name: "Ada", username: "ada", forecast: null, forecast_status: "model_unavailable" },
    history: [{ kind: "exam", title: "Midterm", score_percentage: 90, at: "2026-11-11T08:00:00Z" }],
    predictions: [],
  });
  render(<Page />);
  expect(screen.getByText(/Forecasts are unavailable/)).toBeTruthy();
  expect(screen.getByText("@ada")).toBeTruthy();
  expect(screen.getByText("1 quizzes · 0 coding · 1 exams")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View history" }));
  await waitFor(() => expect(screen.getByText("Midterm")).toBeTruthy());
  expect(screen.getAllByText(/Released exam/).length).toBeGreaterThan(0);
});

it("shows an empty enrollment state", () => {
  mocks.useApi.mockReturnValue({
    loading: false, error: "", reload: vi.fn(), data: {
      course: { title: "Python" }, readiness: { status: "disabled" },
      summary: { active_learners: 0, graded_events: 0, average_score: null, forecast_count: 0, need_support: 0 },
      trend: [], model_quality: { labeled_predictions: 0, accuracy_percent: null }, students: [],
    },
  });
  render(<Page />);
  expect(screen.getByText("No students enrolled yet")).toBeTruthy();
});

it("shows a loading state before course data arrives", () => {
  mocks.useApi.mockReturnValue({ loading: true, error: "", reload: vi.fn(), data: null });
  render(<Page />);
  expect(screen.getByText("Loading Machine Learning dashboard…")).toBeTruthy();
});

it("shows the selected model, dated forecast and observed quality", async () => {
  const forecast = { id: "forecastone", target_activity: "Next quiz", probability: 0.72,
    predicted_pass: true, label: "Likely to pass", model_version: "v2.0.0", selected_model: "random_forest",
    as_of: "2026-11-11T08:00:00Z", actual_outcome: null,
    advisory: "Advisory only; grades, rewards and access are unchanged." };
  const student = { student_id: "studentalpha", display_name: "Ada", username: "ada",
    average_score: 80, latest_score: 80, quiz_count: 1, challenge_count: 0, exam_count: 0,
    forecast_status: "saved", forecast, target_activity: "Next quiz" };
  mocks.useApi.mockReturnValue({ loading: false, error: "", reload: vi.fn(), data: {
    course: { title: "Python" }, readiness: { status: "ready" },
    summary: { active_learners: 1, graded_events: 1, average_score: 80, forecast_count: 1, need_support: 0 },
    trend: [{ date: "2026-11-11", quiz: 80, challenge: null, exam: null }],
    model_quality: { labeled_predictions: 4, accuracy_percent: 75 }, students: [student],
  } });
  mocks.apiRequest.mockResolvedValue({ student, history: [], predictions: [forecast] });
  render(<Page />);
  expect(screen.getByText(/75% across 4 labeled predictions/)).toBeTruthy();
  expect(screen.getByText(/72% · v2.0.0/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View history" }));
  await waitFor(() => expect(screen.getByText(/Random forest/)).toBeTruthy());
  expect(screen.getByText("Pass")).toBeTruthy();
  expect(screen.getByText(/grades, rewards and access are unchanged/)).toBeTruthy();
});
