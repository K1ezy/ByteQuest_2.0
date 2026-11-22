"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAccessibility } from "@/components/accessibility-provider";
import { SeriesSwatch, type ChartProps, type ChartRow, type Series, type TooltipText } from "./line-chart";

/** One box for every series at the hovered or keyboard-selected point. */
export function ChartTooltip({ row, series, text, formatX }: {
  row?: ChartRow; series: Series[]; text?: TooltipText; formatX?: ChartProps["formatX"];
}) {
  if (!row) return null;
  const title = text?.title?.(row) ?? formatX?.(row.x) ?? String(row.x);
  const lines = series.flatMap(s => {
    const value = text?.value ? text.value(s, row) : row[s.key] == null ? null : String(row[s.key]);
    return value === null ? [] : [{ s, value }];
  });
  return <div className="insight-tooltip">
    <p className="insight-tooltip-title">{title}</p>
    {lines.length ? <ul>{lines.map(({ s, value }) => <li key={s.key}>
      <SeriesSwatch series={s} /><span>{s.label}</span><strong>{value}</strong></li>)}</ul> : <p>No data</p>}
  </div>;
}

export default function Plot({ rows, series, domain, numericX, formatX, references, connectGaps, label, summary, tooltip }: ChartProps) {
  const { preferences } = useAccessibility();
  const animate = !preferences.reducedMotion;
  return <div className="insight-plot"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
    {/* Recharts' accessibility layer makes the chart focusable; arrow keys then move the tooltip. */}
    <LineChart data={rows} margin={{ top: 20, right: 20, bottom: 8, left: 0 }} title={label}
      desc={summary + " Use the left and right arrow keys to move between points."}>
      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
      <XAxis dataKey="x" type={numericX ? "number" : "category"} domain={numericX ? ["dataMin", "dataMax"] : undefined}
        tickFormatter={formatX} stroke="var(--chart-annotation)" />
      <YAxis domain={domain} width={44} stroke="var(--chart-annotation)" />
      {references?.map(r => <ReferenceLine key={r.label} x={r.x} y={r.y} segment={r.diagonal ? [{x:0,y:0},{x:1,y:1}] : undefined}
        stroke="var(--chart-annotation)" strokeDasharray="3 3" label={{value:r.label,fill:"var(--chart-annotation)",fontSize:11}} />)}
      {/* filterNull off: a point where every series is empty still has a row to describe. */}
      <Tooltip filterNull={false} isAnimationActive={animate} cursor={{ stroke: "var(--chart-annotation)", strokeDasharray: "3 3" }}
        content={({ active, payload }) => active
          ? <ChartTooltip row={payload?.[0]?.payload as ChartRow | undefined} series={series} text={tooltip} formatX={formatX} />
          : null} />
      {series.map(s => <Line key={s.key} dataKey={s.key} stroke={s.token} strokeDasharray={s.dash} strokeWidth={2}
        connectNulls={connectGaps ?? false} isAnimationActive={animate} animationDuration={220}
        // Solid outlines: dots would otherwise inherit the line's dash and look broken.
        dot={{r:3, strokeDasharray:"0"}} activeDot={{r:5, strokeDasharray:"0"}} />)}
    </LineChart>
  </ResponsiveContainer></div>;
}
