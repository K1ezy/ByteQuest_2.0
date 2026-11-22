import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ChartProps } from "./line-chart";
import { ChartTooltip } from "./plot";
import { Trend, scoreText } from "@/app/(workspace)/instructor/performance/forecasts";
import { CurveChart } from "@/app/(workspace)/instructor/ml/evaluation";
import EngagementChart from "@/components/instructor/engagement-chart";

// The lazily loaded plot draws one tooltip per row instead of a Recharts canvas,
// so each chart's wording can be read directly.
vi.mock("next/dynamic", async () => {
  const { ChartTooltip: Tip } = await vi.importActual<typeof import("./plot")>("./plot");
  return { default: () => (p: ChartProps) => <div data-testid="tooltips">{p.rows.map((row, i) =>
    <Tip key={i} row={row} series={p.series} text={p.tooltip} formatX={p.formatX} />)}</div> };
});
vi.mock("@/components/accessibility-provider", () => ({ useAccessibility: () => ({ preferences: { reducedMotion: true } }) }));
afterEach(cleanup);

const series = [{ key: "a", label: "A", token: "red" }, { key: "b", label: "B", token: "blue", dash: "4 2" }];

it("titles the default tooltip with the axis format and leaves out empty series", () => {
  render(<ChartTooltip row={{ x: 3, a: 7, b: null }} series={series} formatX={x => "Week " + x} />);
  expect(screen.getByText("Week 3")).toBeTruthy();
  expect(screen.getByText("7")).toBeTruthy();
  expect(screen.queryByText("B")).toBeNull();
  cleanup();
  render(<ChartTooltip row={{ x: 3, a: null, b: null }} series={series} />);
  expect(screen.getByText("No data")).toBeTruthy();
});

it("says how many results each daily average uses, by UTC day, in the tooltip and the table", async () => {
  render(<Trend label="Class score trend" timezone="UTC" events={47} points={[
    { date: "2026-11-14", quiz: 66.7, challenge: 0, exam: 71.5, quiz_count: 1, challenge_count: 2, exam_count: 45 },
  ]} />);
  const tooltips = await screen.findByTestId("tooltips");
  expect(tooltips.textContent).toContain("Sat, Nov 14, 2026 (UTC day)");
  expect(tooltips.textContent).toContain("66.7% average · 1 attempt");
  expect(tooltips.textContent).toContain("0% average · 2 attempts");
  expect(tooltips.textContent).toContain("71.5% average · 45 exam submissions");
  fireEvent.click(screen.getByText("View as table"));
  const table = screen.getByRole("table", { name: "Class score trend" });
  expect(table.textContent).toContain("Date (UTC)");
  expect(table.textContent).toContain("71.5% average · 45 exam submissions");
});

it("marks a kind with no results that day instead of hiding it", () => {
  expect(scoreText("exam", { exam: null, exam_count: 0 })).toBe("no results");
});

it("never shows numbers for a week hidden for privacy", async () => {
  render(<EngagementChart codexWeek={9} memoryWeek={9} weeks={[
    { week: 0, eligible: 3, active: 2, events: 4 },
    { week: 1, eligible: 50, active: 31, events: 140 },
  ]} />);
  const tooltips = await screen.findByTestId("tooltips");
  expect(tooltips.textContent).toContain("Week 1Active learners (%)Not enough data yet");
  expect(tooltips.textContent).toContain("62% active · 31 of 50 learners · 140 practice events");
  expect(tooltips.textContent).not.toMatch(/2 of 3|3 learners|4 practice/);
});

it("shows only models that have a real point at that rate", async () => {
  render(<CurveChart label="ROC" xLabel="False positive rate" yLabel="True positive rate" diagonal series={[
    { key: "logreg", x: [0, 0.2], y: [0, 0.75] },
    { key: "random_forest", x: [0, 0.5], y: [0, 0.8] },
  ]} />);
  const tooltips = await screen.findByTestId("tooltips");
  const at02 = [...tooltips.children].find(el => el.textContent?.startsWith("False positive rate 0.20"));
  expect(at02?.textContent).toContain("0.75");
  expect(at02?.textContent).not.toMatch(/Random forest/);
});
