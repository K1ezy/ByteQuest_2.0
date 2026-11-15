"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { StatCard, StatusChip } from "@/components/workspace/ui";

// Mirrors backend app/services/gamification/insights.py (GamificationInsights).
export interface WeekPoint { week: number; eligible: number; active: number; events: number }
export interface CategoryCount { category: string; label: string; failed_tries: number; recoveries: number }
export interface TopicRecovery { topic: string; students_struggling: number; students_stuck: number; categories: CategoryCount[] }
export interface RecallStage { stage: number; interval_days: number; submitted: number; passed: number; pass_rate: number | null }
export interface GamificationInsightsData {
  course_id: string;
  course_code: string;
  course_title: string;
  generated_at: string;
  enrolled: number;
  active: number;
  weekly: WeekPoint[];
  rollout: { codex_unlock_day: number; memory_unlock_day: number };
  solve_quality: { solved: number; stars: Record<string, number>; self_solved_rate: number | null };
  help_seeking: { hinted: number; tried_before_hint: number; rate: number | null };
  topics: TopicRecovery[];
  memory: { submitted: number; passed: number; pass_rate: number | null; stages: RecallStage[] };
}

const SMALL_SAMPLE = 5;
const percent = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);
const sampleNote = (n: number, noun: string) =>
  `${n} ${noun}${n === 1 ? "" : "s"}${n > 0 && n < SMALL_SAMPLE ? " · small sample" : ""}`;

/** Width of an element in CSS pixels, so the chart is drawn at real size and its text never shrinks. */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const HEIGHT = 240;
const MARGIN = { top: 30, right: 28, bottom: 34, left: 44 };

export function EngagementChart({ weeks, codexWeek, memoryWeek }: { weeks: WeekPoint[]; codexWeek: number; memoryWeek: number }) {
  const [box, width] = useWidth<HTMLDivElement>(640);
  const [focus, setFocus] = useState<number | null>(null);
  const titleId = useId();
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const count = weeks.length;
  const x = (week: number) => MARGIN.left + (count <= 1 ? plotWidth / 2 : (week / (count - 1)) * plotWidth);
  const y = (rate: number) => MARGIN.top + (1 - rate) * plotHeight;
  const rate = (point: WeekPoint) => (point.eligible ? point.active / point.eligible : 0);
  const line = weeks.map((point, index) => `${index ? "L" : "M"}${x(point.week).toFixed(1)},${y(rate(point)).toFixed(1)}`).join(" ");
  const last = weeks.at(-1);
  const labelEvery = count > 8 ? 2 : 1;
  const focused = focus === null ? null : weeks[focus];
  const markers = [
    { week: codexWeek, label: "Codex unlocks" },
    { week: memoryWeek, label: "Memory unlocks" },
  ].filter((marker) => marker.week < count);

  const describe = (point: WeekPoint) =>
    `Week ${point.week + 1}: ${percent(point.eligible ? rate(point) : null)} active, ${point.active} of ${point.eligible} learners, ${point.events} practice events`;

  function nearest(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    const index = count <= 1 ? 0 : Math.round(((px - MARGIN.left) / plotWidth) * (count - 1));
    setFocus(Math.min(count - 1, Math.max(0, index)));
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    setFocus((current) => {
      const start = current ?? (event.key === "ArrowLeft" ? count : -1);
      if (event.key === "Home") return 0;
      if (event.key === "End") return count - 1;
      return Math.min(count - 1, Math.max(0, start + (event.key === "ArrowRight" ? 1 : -1)));
    });
  }

  if (!count) return <p className="ws-muted">No practice yet. The curve appears once learners start activities.</p>;

  return (
    <div
      ref={box}
      className="insights-chart"
      tabIndex={0}
      role="group"
      aria-labelledby={titleId}
      aria-describedby={`${titleId}-help`}
      onKeyDown={onKey}
      onBlur={() => setFocus(null)}
    >
      <span id={titleId} className="sr-only">Share of learners active each week since their first activity</span>
      <span id={`${titleId}-help`} className="sr-only">Use the left and right arrow keys to read each week.</span>
      <svg width={width} height={HEIGHT} aria-hidden="true" onPointerMove={nearest} onPointerLeave={() => setFocus(null)}>
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line className="insights-grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
            <text className="insights-axis" x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">{tick * 100}%</text>
          </g>
        ))}
        {weeks.map((point, index) => (index % labelEvery === 0 || index === count - 1) && (
          <text key={point.week} className="insights-axis" x={x(point.week)} y={HEIGHT - 10} textAnchor="middle">
            {count > 6 ? `W${point.week + 1}` : `Week ${point.week + 1}`}
          </text>
        ))}
        {markers.map((marker) => (
          <g key={marker.label}>
            <line className="insights-marker" x1={x(marker.week)} x2={x(marker.week)} y1={MARGIN.top - 6} y2={MARGIN.top + plotHeight} />
            <text className="insights-marker-label" x={x(marker.week)} y={MARGIN.top - 12}
              textAnchor={x(marker.week) > width - 110 ? "end" : x(marker.week) < MARGIN.left + 40 ? "start" : "middle"}>
              {marker.label}
            </text>
          </g>
        ))}
        {count > 1 ? <path className="insights-line" d={line} /> : null}
        {focused ? (
          <g>
            <line className="insights-crosshair" x1={x(focused.week)} x2={x(focused.week)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />
            <circle className="insights-dot" cx={x(focused.week)} cy={y(rate(focused))} r={4.5} />
          </g>
        ) : last ? (
          <g>
            <circle className="insights-dot" cx={x(last.week)} cy={y(rate(last))} r={4.5} />
            <text className="insights-value" x={x(last.week)} y={y(rate(last)) - 12}
              textAnchor={count > 1 ? "end" : "middle"}>{percent(rate(last))}</text>
          </g>
        ) : null}
      </svg>
      {focused ? (
        <div
          className="insights-tooltip"
          style={{ left: `${Math.min(width - 190, Math.max(0, x(focused.week) - 95))}px` }}
        >
          <strong>{percent(focused.eligible ? rate(focused) : null)} active</strong>
          <span>Week {focused.week + 1} · {focused.active} of {focused.eligible} learners</span>
          <span>{focused.events} practice events{focused.eligible < SMALL_SAMPLE ? " · small sample" : ""}</span>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">{focused ? describe(focused) : ""}</p>
    </div>
  );
}

export function MeterList({ rows, label }: { rows: { name: string; detail: string; value: number; total: number; figure: string }[]; label: string }) {
  return (
    <ul className="insights-meters" aria-label={label}>
      {rows.map((row) => (
        <li key={row.name}>
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

function RecoveryTable({ topics }: { topics: TopicRecovery[] }) {
  if (!topics.length) return <p className="ws-muted">No failed attempts on this course&apos;s challenges yet.</p>;
  const categories = topics[0].categories.map(({ category, label }) => ({ category, label }));
  return (
    <div className="ws-table-wrap">
      <table className="ws-table insights-table">
        <caption className="sr-only">Error recovery by topic: failed tries and recoveries per error type</caption>
        <thead>
          <tr>
            <th scope="col">Topic</th>
            <th scope="col">Struggling</th>
            <th scope="col">Still stuck</th>
            {categories.map(({ category, label }) => <th scope="col" key={category}>{label}<span className="sr-only"> errors: failed, recovered</span></th>)}
          </tr>
        </thead>
        <tbody>
          {topics.map((topic) => (
            <tr key={topic.topic}>
              <th scope="row">{topic.topic}</th>
              <td>{topic.students_struggling}</td>
              <td>{topic.students_stuck
                ? <StatusChip state="stuck" tone="wait" label={`${topic.students_stuck} stuck`} />
                : <span className="ws-muted">0</span>}</td>
              {topic.categories.map((cell) => (
                <td key={cell.category} className={cell.failed_tries ? undefined : "ws-muted"}>
                  {cell.failed_tries ? <>{cell.failed_tries} <span className="ws-muted">failed</span> · {cell.recoveries} <span className="ws-muted">recovered</span></> : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STAR_ROWS = [
  { stars: 3, name: "★★★", detail: "No hints, within 2 attempts" },
  { stars: 2, name: "★★", detail: "No hints" },
  { stars: 1, name: "★", detail: "Solved after a hint" },
];

export function GamificationInsightsView({ data }: { data: GamificationInsightsData }) {
  const { solve_quality: quality, help_seeking: help, memory } = data;
  const codexWeek = Math.floor(data.rollout.codex_unlock_day / 7);
  const memoryWeek = Math.floor(data.rollout.memory_unlock_day / 7);

  return (
    <div className="insights-view">
      <div className="ws-stat-grid">
        <StatCard label="Active learners" value={`${data.active} of ${data.enrolled}`} hint="Practised at least once in this course" icon="◉" tone="info" />
        <StatCard label="Self-solved" value={percent(quality.self_solved_rate)} hint={sampleNote(quality.solved, "solved challenge")} icon="★" tone="good" />
        <StatCard label="Tried before asking" value={percent(help.rate)} hint={sampleNote(help.hinted, "hinted challenge")} icon="↻" tone="info" />
        <StatCard label="Recall pass rate" value={percent(memory.pass_rate)} hint={sampleNote(memory.submitted, "recall")} icon="✦" tone="info" />
      </div>

      <section className="ws-panel" aria-labelledby="engagement-title">
        <div className="ws-panel-head">
          <div>
            <p className="eyebrow-label">Engagement over time</p>
            <h2 id="engagement-title">Learners active each week</h2>
            <p className="ws-muted">Weeks count from each learner&apos;s first activity. A dip around weeks 4–6 is the documented novelty effect; the markers show when new mechanics unlock.</p>
          </div>
        </div>
        <EngagementChart weeks={data.weekly} codexWeek={codexWeek} memoryWeek={memoryWeek} />
        {data.weekly.length ? (
          <details className="insights-table-toggle">
            <summary>Show as table</summary>
            <div className="ws-table-wrap">
              <table className="ws-table insights-table">
                <caption className="sr-only">Learners active each week since their first activity</caption>
                <thead><tr><th scope="col">Week</th><th scope="col">Learners reached</th><th scope="col">Active</th><th scope="col">Share active</th><th scope="col">Practice events</th></tr></thead>
                <tbody>
                  {data.weekly.map((point) => (
                    <tr key={point.week}>
                      <th scope="row">Week {point.week + 1}</th>
                      <td>{point.eligible}</td>
                      <td>{point.active}</td>
                      <td>{percent(point.eligible ? point.active / point.eligible : null)}</td>
                      <td>{point.events}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </section>

      <div className="ws-columns">
        <section className="ws-panel" aria-labelledby="quality-title">
          <p className="eyebrow-label">Solve quality</p>
          <h2 id="quality-title">How challenges were solved</h2>
          {quality.solved ? (
            <MeterList label="Solved challenges by stars" rows={STAR_ROWS.map((row) => {
              const value = quality.stars[String(row.stars)] ?? 0;
              return { name: row.name, detail: row.detail, value, total: quality.solved,
                figure: `${value} (${percent(value / quality.solved)})` };
            })} />
          ) : <p className="ws-muted">No challenges solved yet.</p>}
          <p className="ws-muted insights-footnote">Tried before asking: {help.tried_before_hint} of {help.hinted} hinted challenges had a run or attempt before the first hint.</p>
        </section>

        <section className="ws-panel" aria-labelledby="memory-title">
          <p className="eyebrow-label">Mastery Memory</p>
          <h2 id="memory-title">Recall retention by spacing</h2>
          {memory.submitted ? (
            <MeterList label="Recall pass rate by stage" rows={memory.stages.map((stage) => ({
              name: `Day-${stage.interval_days} recall`,
              detail: stage.submitted ? sampleNote(stage.submitted, "recall") : "No recalls yet",
              value: stage.passed, total: stage.submitted,
              figure: stage.submitted ? `${stage.passed} of ${stage.submitted} (${percent(stage.pass_rate)})` : "—",
            }))} />
          ) : <p className="ws-muted">No recalls submitted yet. They begin once Mastery Memory unlocks (day {data.rollout.memory_unlock_day}).</p>}
        </section>
      </div>

      <section className="ws-panel" aria-labelledby="recovery-title">
        <p className="eyebrow-label">Debugging</p>
        <h2 id="recovery-title">Where learners struggle and recover</h2>
        <p className="ws-muted">Failed tries include sample runs. A recovery is a first pass after failing with that error type. Topics with learners still stuck come first.</p>
        <RecoveryTable topics={data.topics} />
      </section>

      <details className="ws-panel insights-method">
        <summary>How these measures are defined</summary>
        <ul>
          <li><strong>Scope:</strong> active students enrolled in this course and its published activities. Figures are class totals; no individual learner is shown.</li>
          <li><strong>Learner week:</strong> counted from each learner&apos;s first practice activity, the same clock that unlocks the Codex (day {data.rollout.codex_unlock_day}) and Mastery Memory (day {data.rollout.memory_unlock_day}).</li>
          <li><strong>Stars:</strong> ★ solved · ★★ no hint before the passing attempt · ★★★ also within 2 attempts. Exam attempts are excluded.</li>
          <li><strong>Tried before asking:</strong> a sample run or attempt happened before the first hint on that challenge.</li>
          <li><strong>Recall:</strong> a passed recall recalled at least two-thirds of its questions.</li>
          <li>Rates with fewer than {SMALL_SAMPLE} observations are marked as a small sample.</li>
        </ul>
      </details>
    </div>
  );
}
