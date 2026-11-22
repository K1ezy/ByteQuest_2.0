import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InsightLineChart, type ChartProps } from "./line-chart";
import Plot from "./plot";
import { MeterList, MeasureDefinitions } from "./ui";
import { metrics } from "@/lib/insight-metrics";
import type { ReactNode } from "react";
vi.mock("@/components/accessibility-provider", () => ({useAccessibility:() => ({preferences:{reducedMotion:true}})}));
vi.mock("recharts", () => {
  const wrap = ({children}:{children:ReactNode}) => <div>{children}</div>;
  return {ResponsiveContainer:wrap,LineChart:wrap,CartesianGrid:()=>null,XAxis:()=>null,YAxis:()=>null,ReferenceLine:()=>null,
    Line:({isAnimationActive}:{isAnimationActive:boolean})=><span data-testid="line">{String(isAnimationActive)}</span>};
});
afterEach(cleanup);
const chart:ChartProps = {rows:[{x:"Monday",score:80}],series:[{key:"score",label:"Score",token:"var(--chart-series)"}],
  domain:[0,100],xLabel:"Day",label:"Scores",summary:"Monday averaged 80%."};
it("exposes the summary, table and reduced-motion plot", () => {
  render(<><InsightLineChart {...chart}/><Plot {...chart}/></>);
  expect(screen.getByRole("img",{name:/Monday averaged 80%/})).toBeTruthy();
  fireEvent.click(screen.getByText("View as table"));
  expect(screen.getByRole("table",{name:"Scores"})).toBeTruthy();
  expect(screen.getAllByTestId("line").every(line=>line.textContent==="false")).toBe(true);
});
it("exposes meter values and the shared measure definition", () => {
  render(<><MeterList label="Attempts" rows={[{name:"Group",value:1,total:2,figure:"1 of 2"}]}/><MeasureDefinitions names={["active_7d"]}/></>);
  expect(screen.getByRole("img",{name:"Group: 1 of 2"})).toBeTruthy();
  fireEvent.click(screen.getByText("How these measures are defined"));
  expect(screen.getByText(metrics.active_7d.label)).toBeTruthy();
  expect(screen.getByText(new RegExp(metrics.active_7d.definition))).toBeTruthy();
});
