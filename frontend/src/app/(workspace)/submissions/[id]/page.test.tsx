import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "job-1" }) }));
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
const job = (result: object) => ({ id: "job-1", activity_id: "activity-1", status: "completed", error: null, result });

beforeEach(() => mocks.apiRequest.mockReset());
afterEach(cleanup);

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
