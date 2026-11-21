"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useAccessibility } from "@/components/accessibility-provider";
import type { ChartProps } from "./line-chart";

export default function Plot({ rows, series, domain, numericX, formatX, references, connectGaps }: ChartProps) {
  const { preferences } = useAccessibility();
  return <div className="insight-plot"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
    <LineChart data={rows} margin={{ top: 20, right: 20, bottom: 8, left: 0 }}>
      <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
      <XAxis dataKey="x" type={numericX ? "number" : "category"} domain={numericX ? ["dataMin", "dataMax"] : undefined}
        tickFormatter={formatX} stroke="var(--chart-annotation)" />
      <YAxis domain={domain} width={44} stroke="var(--chart-annotation)" />
      {references?.map(r => <ReferenceLine key={r.label} x={r.x} y={r.y} segment={r.diagonal ? [{x:0,y:0},{x:1,y:1}] : undefined}
        stroke="var(--chart-annotation)" strokeDasharray="3 3" label={{value:r.label,fill:"var(--chart-annotation)",fontSize:11}} />)}
      {series.map(s => <Line key={s.key} dataKey={s.key} stroke={s.token} strokeDasharray={s.dash} strokeWidth={2}
        connectNulls={connectGaps ?? false} dot={{r:2}} isAnimationActive={!preferences.reducedMotion} animationDuration={220} />)}
    </LineChart>
  </ResponsiveContainer></div>;
}
