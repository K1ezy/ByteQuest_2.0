"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

export type Series = { key: string; label: string; token: string; dash?: string };
export type ChartRow = { x: string | number } & Record<string, number | string | null>;
export interface ChartProps {
  rows: ChartRow[]; series: Series[]; label: string; summary: string; xLabel: string;
  formatX?: (value: string | number) => string; domain: [number, number];
  numericX?: boolean; connectGaps?: boolean;
  references?: { label: string; x?: string | number; y?: number; diagonal?: boolean }[];
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
    <div role="img" aria-label={props.label + ". " + props.summary}><Plot {...props} /></div>
    <p className="insight-legend">{props.series.map(s => <span key={s.key}>
      <svg aria-hidden="true" width="24" height="10" viewBox="0 0 24 10"><line x1="0" x2="24" y1="5" y2="5"
        stroke={s.token} strokeWidth="3" strokeDasharray={s.dash}/></svg> {s.label}</span>)}</p>
    <details className="insights-table-toggle"><summary>View as table</summary><div className="ws-table-wrap">
      {props.table ?? <table className="ws-table analysis-table"><caption>{props.label}</caption>
        <thead><tr><th scope="col">{props.xLabel}</th>{props.series.map(s => <th scope="col" key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>{props.rows.map((row,i) => <tr key={i}><th scope="row">{props.formatX?.(row.x) ?? row.x}</th>
          {props.series.map(s => <td key={s.key}>{row[s.key] ?? "—"}</td>)}</tr>)}</tbody></table>}
    </div></details>
  </div>;
}
