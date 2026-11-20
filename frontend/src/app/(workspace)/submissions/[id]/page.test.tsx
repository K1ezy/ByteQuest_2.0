import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), loadMonaco: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "job-1" }) }));
vi.mock("@monaco-editor/react", () => ({
  loader: { config: vi.fn(), init: mocks.loadMonaco },
  DiffEditor: () => <div>Read-only test diff</div>,
}));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, apiRequest: mocks.apiRequest };
});

import SubmissionStatusPage from "./page";

const evaluation = (passed: boolean) => ({
  is_successful: passed, passed_test_cases: passed ? 3 : 1, total_test_cases: 3, score_percentage: passed ? 100 : 33,
  test_results: [], avg_execution_time_ms: 10, max_memory_used_kb: 1024, dominant_status_id: passed ? 3 : 4,
  dominant_error_category: passed ? "none" : "logic_error",
});
const job = (result: object) => ({ id: "job-1", activity_id: "activity-1", status: "completed", dry_run_only: false, error: null, created_at: new Date().toISOString(), result });

beforeEach(() => {
  mocks.apiRequest.mockReset();
  mocks.loadMonaco.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

const previousAttempt = { attempt_number: 1, submitted_code: "print(0)", passed_test_cases: 2, total_test_cases: 5,
  score_percentage: 40, is_successful: false };
const currentAttempt = { ...previousAttempt, attempt_number: 2, submitted_code: "print(n)", passed_test_cases: 5,
  score_percentage: 100, is_successful: true };

it("loads the practice comparison on demand and retries without leaving the result", async () => {
  mocks.apiRequest.mockResolvedValueOnce(job({ evaluation: evaluation(false) }))
    .mockRejectedValueOnce(new Error("Comparison request failed."))
    .mockResolvedValueOnce({ language: "python", previous: previousAttempt, current: currentAttempt });
  render(<SubmissionStatusPage />);

  const compare = await screen.findByRole("button", { name: "Compare with previous attempt" });
  expect(mocks.apiRequest).toHaveBeenCalledTimes(1);
  fireEvent.click(compare);
  expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, "/submission-jobs/job-1/comparison", expect.anything());
  expect((await screen.findByRole("alert")).textContent).toBe("Comparison request failed.");
  fireEvent.click(screen.getByRole("button", { name: "Retry comparison" }));
  expect(await screen.findByText("Score rose by 60 percentage points.")).toBeTruthy();
  expect(screen.getByText("2 / 5 tests passed")).toBeTruthy();
  expect(screen.getByText("5 / 5 tests passed")).toBeTruthy();
  expect(await screen.findByText("Read-only test diff")).toBeTruthy();
  expect(screen.getByText("View plain-text code")).toBeTruthy();
  expect(screen.getByText("print(0)")).toBeTruthy();
  expect(screen.getByText("print(n)")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hide attempt comparison" }));
  expect(screen.queryByText("print(n)")).toBeNull();
});

it.each([
  [null, "This is your first graded practice attempt for this challenge version."],
  [{ ...previousAttempt, submitted_code: currentAttempt.submitted_code }, "The submitted code is identical in both attempts."],
  [{ ...previousAttempt, submitted_code: null }, "A saved code version is missing, so code changes are unavailable."],
])("shows a clear state when a diff is unnecessary or unavailable", async (previous, message) => {
  mocks.apiRequest.mockResolvedValueOnce(job({ evaluation: evaluation(true) }))
    .mockResolvedValueOnce({ language: "python", previous, current: currentAttempt });
  render(<SubmissionStatusPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Compare with previous attempt" }));
  expect(await screen.findByText(message)).toBeTruthy();
  expect(screen.queryByText("Read-only test diff")).toBeNull();
});

it("keeps sample results out of the comparison action", async () => {
  mocks.apiRequest.mockResolvedValueOnce({ ...job({ evaluation: evaluation(true) }), dry_run_only: true });
  render(<SubmissionStatusPage />);
  await screen.findByRole("heading", { name: "Grading complete" });
  expect(screen.queryByRole("button", { name: "Compare with previous attempt" })).toBeNull();
});

it("offers both code versions when the local editor fails to load", async () => {
  mocks.loadMonaco.mockRejectedValueOnce(new Error("Monaco unavailable"));
  mocks.apiRequest.mockResolvedValueOnce(job({ evaluation: evaluation(true) }))
    .mockResolvedValueOnce({ language: "python", previous: previousAttempt, current: currentAttempt });
  render(<SubmissionStatusPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Compare with previous attempt" }));
  expect(await screen.findByText(/The code diff is unavailable/)).toBeTruthy();
  fireEvent.click(screen.getByText("View plain-text code"));
  expect(screen.getByText("Previous submitted code · Attempt 1")).toBeTruthy();
  expect(screen.getByText("Current submitted code · Attempt 2")).toBeTruthy();
});

it("shows Codex recovery news for the categories reported on a pass", async () => {
  mocks.apiRequest.mockResolvedValue(job({
    evaluation: evaluation(true), quality: { stars: 2, max_stars: 3, hints_before: 0, self_solved: true },
    codex_recoveries: [{ category: "logic_error", label: "Logic" }],
  }));
  render(<SubmissionStatusPage />);
  expect(await screen.findByText("Codex: you recovered from a Logic error")).toBeTruthy();
});

it("celebrates a self-solved pass with its stars, level-up and new badge", async () => {
  mocks.apiRequest.mockResolvedValue(job({
    attempt_number: 1, xp_awarded: 40, new_level: 2, level_up: true, new_badges_unlocked: ["First Steps"],
    quality: { stars: 3, max_stars: 3, hints_before: 0, self_solved: true }, evaluation: evaluation(true),
  }));
  render(<SubmissionStatusPage />);

  expect(await screen.findByRole("img", { name: "3 of 3 stars: Solved without hints in 2 attempts or fewer" })).toBeTruthy();
  expect(screen.getByText("Self-solved: no hints used")).toBeTruthy();
  expect(screen.getByText("Level up! You reached Level 2.")).toBeTruthy();
  expect(screen.getByText("First Steps")).toBeTruthy();
  expect(screen.queryByText(/On your next challenge/)).toBeNull();
});

it("describes hint use neutrally and suggests the next star without any penalty wording", async () => {
  mocks.apiRequest.mockResolvedValue(job({
    attempt_number: 2, xp_awarded: 40, new_level: 1, level_up: false, new_badges_unlocked: [],
    quality: { stars: 1, max_stars: 3, hints_before: 2, self_solved: false }, evaluation: evaluation(true),
  }));
  render(<SubmissionStatusPage />);

  expect(await screen.findByRole("img", { name: "1 of 3 stars: Solved" })).toBeTruthy();
  expect(screen.getByText("2 hints used before passing")).toBeTruthy();
  expect(screen.getByText(/try a sample run before opening a hint/)).toBeTruthy();
  expect(screen.queryByText(/Level up/)).toBeNull();
  expect(screen.queryByText(/Badge unlocked/)).toBeNull();
});

it("shows no stars or rewards for a failed attempt", async () => {
  mocks.apiRequest.mockResolvedValue(job({
    attempt_number: 1, xp_awarded: 0, new_level: 1, level_up: false, new_badges_unlocked: [],
    quality: { stars: 0, max_stars: 3, hints_before: 0, self_solved: false }, evaluation: evaluation(false),
  }));
  render(<SubmissionStatusPage />);

  expect(await screen.findByText(/Some tests did not pass/)).toBeTruthy();
  expect(screen.queryByRole("img", { name: /stars/ })).toBeNull();
});


const oldSubmission = {
  id: "job-1", activity_id: "activity-1", created_at: new Date(Date.now() - 65_000).toISOString(),
  error: null, result: null,
};

it("shows a grading delay immediately when revisiting an older submission", async () => {
  mocks.apiRequest.mockResolvedValue({ ...oldSubmission, status: "running" });
  render(<SubmissionStatusPage />);

  expect(await screen.findByText("This is taking longer than usual.")).toBeTruthy();
  expect(screen.queryByText(/Executing your solution/)).toBeNull();
});

it("retries the same saved job and resumes polling from the results page", async () => {
  mocks.apiRequest
    .mockResolvedValueOnce({ ...oldSubmission, status: "failed", error: "Code execution is unavailable." })
    .mockResolvedValueOnce({ ...oldSubmission, status: "queued" })
    .mockResolvedValueOnce(job({ attempt_number: 1, xp_awarded: 40, evaluation: evaluation(true) }));
  render(<SubmissionStatusPage />);

  fireEvent.click(await screen.findByRole("button", { name: "Retry grading" }));

  expect(await screen.findByRole("heading", { name: "Grading complete" })).toBeTruthy();
  expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, "/submission-jobs/job-1/retry", { method: "POST" });
  expect(mocks.apiRequest).toHaveBeenNthCalledWith(3, "/submission-jobs/job-1");
});
