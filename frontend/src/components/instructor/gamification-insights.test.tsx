import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GamificationInsightsView, type GamificationInsightsData } from "./gamification-insights";

const categories = (pairs: Record<string, [number, number]>) =>
  [["syntax_error", "Syntax"], ["logic_error", "Logic"], ["runtime_error", "Runtime"], ["timeout", "Time limit"]].map(
    ([category, label]) => ({ category, label, failed_tries: pairs[category]?.[0] ?? 0, recoveries: pairs[category]?.[1] ?? 0 }));

const data: GamificationInsightsData = {
  course_id: "course-1", course_code: "CS1", course_title: "Introduction to Python", generated_at: "2026-11-15T08:00:00Z",
  enrolled: 12, active: 9,
  weekly: [
    { week: 0, eligible: 9, active: 9, events: 40 },
    { week: 1, eligible: 8, active: 6, events: 22 },
    { week: 2, eligible: 4, active: 2, events: 5 },
  ],
  rollout: { codex_unlock_day: 7, memory_unlock_day: 35 },
  solve_quality: { solved: 10, stars: { "1": 2, "2": 3, "3": 5 }, self_solved_rate: 0.8 },
  help_seeking: { hinted: 3, tried_before_hint: 2, rate: 0.667 },
  topics: [
    { topic: "loops", students_struggling: 4, students_stuck: 2, categories: categories({ logic_error: [6, 2] }) },
    { topic: "strings", students_struggling: 1, students_stuck: 0, categories: categories({ syntax_error: [1, 1] }) },
  ],
  memory: { submitted: 0, passed: 0, pass_rate: null, stages: [0, 1, 2, 3].map((stage) => ({
    stage, interval_days: [2, 7, 21, 45][stage], submitted: 0, passed: 0, pass_rate: null })) },
};

afterEach(cleanup);

it("leads with class totals and flags small samples", () => {
  render(<GamificationInsightsView data={data} />);
  expect(screen.getByText("9 of 12")).toBeTruthy();
  expect(screen.getByText("80%")).toBeTruthy();
  expect(screen.getByText("67%")).toBeTruthy();
  expect(screen.getByText("3 hinted challenges · small sample")).toBeTruthy();
  expect(screen.getByText("0 recalls")).toBeTruthy(); // recall tile: no rate yet, and no small-sample flag at zero
  expect(screen.getByText(/No recalls submitted yet\. They begin once Mastery Memory unlocks \(day 35\)/)).toBeTruthy();
});

it("reads every week from the keyboard and marks mechanics that unlocked in range", () => {
  render(<GamificationInsightsView data={data} />);
  const chart = screen.getByRole("group", { name: "Share of learners active each week since their first activity" });
  expect(screen.getByText("Codex unlocks")).toBeTruthy();       // day 7 = week 2, inside the 3 weeks shown
  expect(screen.queryByText("Memory unlocks")).toBeNull();      // day 35 = week 6, not reached yet
  fireEvent.keyDown(chart, { key: "ArrowRight" });
  expect(screen.getByText("Week 1: 100% active, 9 of 9 learners, 40 practice events")).toBeTruthy();
  fireEvent.keyDown(chart, { key: "End" });
  expect(screen.getByText("Week 3: 50% active, 2 of 4 learners, 5 practice events")).toBeTruthy();
  expect(screen.getByText(/practice events · small sample/)).toBeTruthy(); // tooltip on a week with 4 learners

  const table = screen.getByRole("table", { name: "Learners active each week since their first activity" });
  expect(within(table).getAllByRole("row")).toHaveLength(4);
  expect(within(table).getByRole("rowheader", { name: "Week 2" })).toBeTruthy();
});

it("lists stuck topics first with failed and recovered counts per error type", () => {
  render(<GamificationInsightsView data={data} />);
  const table = screen.getByRole("table", { name: /Error recovery by topic/ });
  const rows = within(table).getAllByRole("row").slice(1);
  expect(rows.map((row) => within(row).getByRole("rowheader").textContent)).toEqual(["loops", "strings"]);
  expect(within(rows[0]).getByText("2 stuck")).toBeTruthy();
  expect(rows[0].textContent).toContain("6 failed · 2 recovered");
  expect(screen.getByRole("img", { name: "★★★: 5 (50%)" })).toBeTruthy();
});
