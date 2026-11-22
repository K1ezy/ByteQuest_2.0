import { InsightLineChart } from "@/components/insights/line-chart";
import { SMALL_SAMPLE } from "@/components/insights/ui";
import type { WeekPoint } from "./gamification-insights";

export default function EngagementChart({ weeks, codexWeek, memoryWeek }: {
  weeks: WeekPoint[]; codexWeek: number; memoryWeek: number;
}) {
  const rows = weeks.map(p => {
    const visible = p.eligible >= SMALL_SAMPLE && p.events >= SMALL_SAMPLE;
    return { x: "Week " + (p.week + 1), share: visible ? Math.round(100*p.active/p.eligible) : null,
      active: visible ? p.active : null, reached: visible ? p.eligible : null, events: visible ? p.events : null };
  });
  const latest = rows.filter(r => r.share !== null).at(-1);
  return <InsightLineChart rows={rows} domain={[0,100]} xLabel="Week" label="Learners active each week"
    series={[{key:"share",label:"Active learners (%)",token:"var(--chart-series)"}]}
    // Hidden weeks carry only nulls, so the tooltip cannot reveal what the table suppresses.
    tooltip={{ value: (_, r) => r.share === null ? "Not enough data yet"
      : `${r.share}% active · ${r.active} of ${r.reached} learners · ${r.events} practice events` }}
    summary={latest ? latest.share + "% practised in " + latest.x + "." : "Not enough data yet."}
    references={[{x:"Week "+(codexWeek+1),label:"Codex unlocks"},{x:"Week "+(memoryWeek+1),label:"Memory unlocks"}]}
    table={<table className="ws-table insights-table"><caption>Learners active each week since their first activity</caption>
      <thead><tr>{["Week","Learners reached","Active","Share active","Practice events"].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map(r=><tr key={r.x}><th scope="row">{r.x}</th>{r.share === null ? <td colSpan={4}>Not enough data yet</td>
        : <><td>{r.reached}</td><td>{r.active}</td><td>{r.share}%</td><td>{r.events}</td></>}</tr>)}</tbody>
    </table>} />;
}
