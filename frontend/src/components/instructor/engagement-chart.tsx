"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAccessibility } from "@/components/accessibility-provider";
import type { WeekPoint } from "./gamification-insights";

export default function EngagementChart({ weeks, codexWeek, memoryWeek }: {
  weeks: WeekPoint[]; codexWeek: number; memoryWeek: number;
}) {
  const { preferences } = useAccessibility();
  const data = weeks.map((point) => ({
    week: `Week ${point.week + 1}`,
    share: point.eligible >= 5 && point.events >= 5 ? Math.round(100 * point.active / point.eligible) : null,
  }));
  return <div className="ic-chart" role="group" aria-label="Share of learners active each week since their first activity">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={data} accessibilityLayer margin={{ top: 24, right: 24, bottom: 6, left: 0 }}>
        <CartesianGrid stroke="var(--line)" vertical={false} />
        <XAxis dataKey="week" tick={{ fill: "var(--muted)", fontSize: 12 }} stroke="var(--line)" />
        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} width={44} tickFormatter={(value) => value + "%"}
          tick={{ fill: "var(--muted)", fontSize: 12 }} stroke="var(--line)" />
        <Tooltip formatter={(value) => [value + "%", "Active learners"]} />
        {[{ week: codexWeek, label: "Codex unlocks" }, { week: memoryWeek, label: "Memory unlocks" }].map(({ week, label }) => (
          data[week] ? <ReferenceLine key={label} x={data[week].week} stroke="var(--muted)" strokeDasharray="3 3"
            label={{ value: label, position: "insideTopRight", fill: "var(--muted)", fontSize: 11 }} /> : null
        ))}
        <Line dataKey="share" stroke="var(--purple)" strokeWidth={2} connectNulls={false}
          dot={{ fill: "var(--purple)", r: 3 }} isAnimationActive={preferences.reducedMotion ? false : "auto"} animationDuration={220} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
