"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

export type Series = { key: string; label: string; token: string; dash?: string };
export type ChartRow = { x: string | number } & Record<string, number | string | null>;
/** Wording for the hover and keyboard tooltip. A value of null leaves that series out of the tooltip. */
export type TooltipText = {
  title?: (row: ChartRow) => string;
  value?: (series: Series, row: ChartRow) => string | null;
};
/** How one point reads: passed (filled), not passed yet (hollow), or too few results to trust (faded). */
export type PointState = "passed" | "open" | "faded";
export const POINT_TEXT: Record<PointState, string> = {
  passed: "passed", open: "not passed yet", faded: "fewer than 5 results",
};
export interface ChartProps {
  rows: ChartRow[]; series: Series[]; label: string; summary: string; xLabel: string;
  /** Marks each point; the legend, tooltip and table then say what the marker means. */
  pointState?: (row: ChartRow) => PointState | undefined;
  formatX?: (value: string | number) => string; domain: [number, number];
  numericX?: boolean; connectGaps?: boolean;
  references?: { label: string; x?: string | number; y?: number; diagonal?: boolean }[];
  tooltip?: TooltipText;
}

/** The line style of a series, so the legend and tooltip never rely on colour alone. */
export function SeriesSwatch({ series }: { series: Series }) {
  return <svg aria-hidden="true" width="24" height="10" viewBox="0 0 24 10"><line x1="0" x2="24" y1="5" y2="5"
    stroke={series.token} strokeWidth="3" strokeDasharray={series.dash}/></svg>;
}

const Plot = dynamic(() => import("./plot"), { ssr: false, loading: ChartSkeleton });
export function ChartSkeleton() {
  return <div className="insight-plot ws-skeleton" role="status" aria-label="Loading chart" />;
}
export function InsightLineChart(props: ChartProps & { table?: ReactNode; loading?: boolean; error?: string; retry?: () => void }) {
  if (props.error) return <p role="alert">{props.error} <button type="button" onClick={props.retry}>Retry</button></p>;
  if (props.loading) return <ChartSkeleton />;
  if (!props.rows.length) return <p className="ws-muted">No data yet for {props.label.toLowerCase()}.</p>;
  return <div>
    <p>{props.summary}</p>
    {/* A figure, not role="img": the chart inside is focusable so the keyboard can move its tooltip. */}
    <figure className="insight-figure" aria-label={props.label + ". " + props.summary}><Plot {...props} /></figure>
    <p className="insight-legend">{props.series.map(s => <span key={s.key}><SeriesSwatch series={s}/> {s.label}</span>)}
      {props.pointState && <span className="insight-legend-points">● passed · ○ not passed yet</span>}</p>
    <details className="insights-table-toggle"><summary>View as table</summary><div className="ws-table-wrap">
      {props.table ?? <table className="ws-table analysis-table"><caption>{props.label}</caption>
        <thead><tr><th scope="col">{props.xLabel}</th>{props.series.map(s => <th scope="col" key={s.key}>{s.label}</th>)}
          {props.pointState && <th scope="col">Result</th>}</tr></thead>
        <tbody>{props.rows.map((row,i) => { const state = props.pointState?.(row); return <tr key={i}><th scope="row">{props.formatX?.(row.x) ?? row.x}</th>
          {props.series.map(s => <td key={s.key}>{row[s.key] ?? "—"}</td>)}
          {props.pointState && <td>{state ? POINT_TEXT[state] : "—"}</td>}</tr>; })}</tbody></table>}
    </div></details>
  </div>;
}
