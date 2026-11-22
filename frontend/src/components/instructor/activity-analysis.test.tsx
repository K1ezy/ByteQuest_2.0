import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityAnalysisView, analysisReading } from "./activity-analysis";
import type { ActivityAnalysis } from "@/lib/workspace";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiRequest: request, getErrorMessage: String }));
afterEach(() => { cleanup(); request.mockReset(); });

const analysis: ActivityAnalysis = {
  activity_id: "activity", title: "Loop bounds", activity_type: "challenge",
  course: { id: "course", code: "CS1", title: "Programming 1" },
  class_size: 6, attempted: 4, passed: 2, pass_rate: 0.5, first_try_pass_rate: 0.25,
  median_attempts_to_pass: 2, stuck: 1, stuck_after_attempts: 3, not_started: 2,
  pass_mark_percent: 80, excludes_exam_attempts: true,
  score_distribution: [{ label: "80–100%", count: 2 }],
  error_categories: [{ category: "logic_error", label: "Wrong output", count: 4 }],
  hint_use: { learners: 1, passed: 0 },
};

describe("activity analysis", () => {
  it("gives the most frequent known error a concrete action", () => {
    expect(analysisReading(analysis)).toContain("expected output format");
  });

  it("uses the follow-up reading for tied errors and distinguishes empty/all-pass classes", () => {
    const tied = [...analysis.error_categories, { category: "timeout", label: "Time limit", count: 4 }];
    expect(analysisReading({ ...analysis, error_categories: tied })).toContain("Student Progress");
    expect(analysisReading({ ...analysis, attempted: 0 })).toContain("first graded practice attempt");
    expect(analysisReading({ ...analysis, error_categories: [], stuck: 0, passed: 4 })).toContain("Every learner");
  });

  it("renders the report with a table disclosure and an activity-scoped drill-down", async () => {
    request.mockResolvedValue(analysis);
    render(<ActivityAnalysisView activityId="activity" />);
    expect(await screen.findByRole("heading", { name: "Loop bounds" })).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Stuck learners" }).getAttribute("href"))
      .toBe("/instructor/performance?course=course&activity=activity&stuck=1");
    const disclosure = screen.getAllByText("Show as table")[0];
    fireEvent.click(disclosure);
    expect(disclosure.closest("details")?.open).toBe(true);
    expect(screen.getAllByText("80–100%")).toHaveLength(2);
  });
});
