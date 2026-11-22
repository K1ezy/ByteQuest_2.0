import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { RecallReview, ReviewResult } from "@/lib/types";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(), apiRequest: mocks.api,
}));

import { ReviewRunner } from "./review-runner";

const review: RecallReview = {
  id: "review", concept: "Loops", stage: 0, result: null,
  questions: Array.from({ length: 4 }, (_, index) => ({
    id: `q${index + 1}`, prompt: `Prompt ${index + 1}`, options: [{ key: "A", text: "Option A" }, { key: "B", text: "Option B" }],
  })),
};
const result: ReviewResult = {
  correct: 4, total: 4, passed: true, xp_awarded: 10, new_total_xp: 250, new_level: 2, level_up: true,
  new_badges_unlocked: ["XP Master"], next_due_at: "2026-11-22T07:00:00Z", next_check_days: 7, stage: 1,
};

afterEach(() => { cleanup(); mocks.api.mockReset(); });

it("runs a recall with named radio groups and shows the graded XP and next check", async () => {
  mocks.api.mockResolvedValueOnce(review).mockResolvedValueOnce(result);
  render(<ReviewRunner id="review" />);
  for (let index = 1; index <= 4; index++) {
    const group = await screen.findByRole("radiogroup", { name: `Prompt ${index}` });
    expect(screen.getByText(`Question ${index} of 4`)).toBeTruthy();
    fireEvent.click(within(group).getByRole("radio", { name: /Option A/ }));
    fireEvent.click(screen.getByRole("button", { name: index === 4 ? "Submit review" : "Next question" }));
  }
  const heading = await screen.findByRole("heading", { name: "Memory refreshed: Loops." });
  expect(document.activeElement).toBe(heading);
  expect(screen.getByText("Next check in 7 days.")).toBeTruthy();
  expect(screen.getByText(/\+10 XP/)).toBeTruthy();
  expect(screen.getByText("XP Master")).toBeTruthy();
  expect(mocks.api).toHaveBeenLastCalledWith("/reviews/review/submit", {
    method: "POST", body: JSON.stringify({ answers: { q1: "A", q2: "A", q3: "A", q4: "A" } }),
  });
});

it("restores a submitted recall and describes the next-day retry neutrally", async () => {
  mocks.api.mockResolvedValue({
    ...review, questions: [], result: { ...result, correct: 2, passed: false, xp_awarded: 0, level_up: false, new_badges_unlocked: [] },
  });
  render(<ReviewRunner id="review" />);
  expect(await screen.findByText("No problem, this concept will come back tomorrow so you can lock it in.")).toBeTruthy();
  expect(screen.queryByText(/failed/i)).toBeNull();
});
