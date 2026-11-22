import Link from "next/link";
import type { ReactNode } from "react";
import { metrics, type MetricKey } from "@/lib/insight-metrics";
import { formatManilaDateTime } from "@/lib/activity-date";

export const SMALL_SAMPLE = 5;
export function NotEnoughData({ children }: { children?: ReactNode }) {
  return <span className="ic-note"><strong>Not enough data yet</strong>{children && <><br />{children}</>}</span>;
}
export function UpdatedAt({ at }: { at: string }) {
  return <p className="ws-row-meta">Updated <time dateTime={at}>{formatManilaDateTime(at)}</time></p>;
}
export function MeasureDefinitions({ names, children }: { names: MetricKey[]; children?: ReactNode }) {
  return <details className="insights-method"><summary>How these measures are defined</summary><ul>
    {names.map(key => <li key={key}><strong>{metrics[key].label}</strong> · {metrics[key].definition}</li>)}
    {children}
  </ul></details>;
}
export function MeterList({ rows, label }: { rows: { id?: string; name: string; detail?: ReactNode; value: number; total: number; figure: string }[]; label: string }) {
  if (!rows.length) return <p className="ws-muted">No data yet.</p>;
  return (
    <ul className="insights-meters" aria-label={label}>
      {rows.map((row) => (
        <li key={row.id ?? row.name}>
          <div className="insights-meter-name"><strong>{row.name}</strong><span>{row.detail}</span></div>
          <span className="insights-meter-track" role="img"
            aria-label={`${row.name}: ${row.figure}`}>
            <span className="insights-meter-fill" style={{ width: `${row.total ? (row.value / row.total) * 100 : 0}%` }} />
          </span>
          <span className="insights-meter-figure">{row.figure}</span>
        </li>
      ))}
    </ul>
  );
}


export function PracticeLink({ topic }: { topic: string }) {
  return <Link className="insight-practice" href={"/quests?concept=" + encodeURIComponent(topic)}>Practise {topic}</Link>;
}
