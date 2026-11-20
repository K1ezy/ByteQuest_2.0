"use client";

import dynamic from "next/dynamic";
import { StatusChip } from "@/components/workspace/ui";
import { RowSkeleton, Section, StatStrip } from "./course-ui";

const EngagementChart = dynamic(() => import("./engagement-chart"), {
  ssr: false, loading: () => <div className="ic-chart"><RowSkeleton /></div>,
});

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

function InsufficientData({ children }: { children: string }) {
  return <div className="ic-note"><strong>Not enough data yet</strong><br />{children}</div>;
}

export function GamificationInsightsView({ data, topic }: { data: GamificationInsightsData; topic?: string | null }) {
  const { solve_quality: quality, help_seeking: help, memory } = data;
  const codexWeek = Math.floor(data.rollout.codex_unlock_day / 7);
  const memoryWeek = Math.floor(data.rollout.memory_unlock_day / 7);
  const enoughLearners = data.active >= SMALL_SAMPLE;
  const showEngagement = enoughLearners && data.weekly.filter((point) => point.eligible >= SMALL_SAMPLE && point.events >= SMALL_SAMPLE).length >= SMALL_SAMPLE;
  const memoryUnlocked = memory.submitted > 0 || data.weekly.some((point) => point.week >= memoryWeek && point.eligible > 0);
  const topics = topic ? data.topics.filter((row) => row.topic === topic) : data.topics;

  return <div className="insights-view">
    <StatStrip items={[
      { label: "Practised", value: data.active, note: "of " + data.enrolled + " enrolled" },
      { label: "Self-solved", value: enoughLearners && quality.solved >= SMALL_SAMPLE ? percent(quality.self_solved_rate) : "—", note: quality.solved + " solved challenges" },
      { label: "Tried before asking", value: enoughLearners && help.hinted >= SMALL_SAMPLE ? percent(help.rate) : "—", note: help.hinted + " hinted challenges" },
      { label: "Recall pass rate", value: enoughLearners && memory.submitted >= SMALL_SAMPLE ? percent(memory.pass_rate) : "—", note: memory.submitted + " recalls" },
    ]} />

    <Section title="Learners active each week">
      <p className="ic-note">Weeks count from each learner&apos;s first activity.{data.weekly.length >= 6 ? " A dip around weeks 4–6 is the documented novelty effect." : ""}</p>
      {showEngagement ? <>
        <div className="ic-gamification-frame"><EngagementChart weeks={data.weekly} codexWeek={codexWeek} memoryWeek={memoryWeek} /></div>
        <details className="insights-table-toggle">
          <summary>View as table</summary>
          <div className="ws-table-wrap">
            <table className="ws-table insights-table">
              <caption className="sr-only">Learners active each week since their first activity</caption>
              <thead><tr><th scope="col">Week</th><th scope="col">Learners reached</th><th scope="col">Active</th><th scope="col">Share active</th><th scope="col">Practice events</th></tr></thead>
              <tbody>
                {data.weekly.map((point) => (
                  <tr key={point.week}>
                    <th scope="row">Week {point.week + 1}</th>
                    {point.eligible >= SMALL_SAMPLE && point.events >= SMALL_SAMPLE ? <>
                      <td>{point.eligible}</td><td>{point.active}</td>
                      <td>{percent(point.active / point.eligible)}</td><td>{point.events}</td>
                    </> : <td colSpan={4}>Not enough data yet</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </> : <InsufficientData>Weekly practice trends appear after enough learners and weeks are recorded.</InsufficientData>}
    </Section>

    <Section title="How challenges were solved">
      {enoughLearners && quality.solved >= SMALL_SAMPLE ? (
        <MeterList label="Solved challenges by stars" rows={STAR_ROWS.map((row) => {
          const value = quality.stars[String(row.stars)] ?? 0;
          return { name: row.name, detail: row.detail, value, total: quality.solved,
            figure: value + " (" + percent(value / quality.solved) + ")" };
        })} />
      ) : <InsufficientData>Challenge solve quality appears after enough successful submissions.</InsufficientData>}
      {enoughLearners && help.hinted >= SMALL_SAMPLE ? <p className="ic-note">Tried before asking: {help.tried_before_hint} of {help.hinted} hinted challenges had a run or attempt before the first hint.</p> : null}
    </Section>

    <Section title="Recall retention by spacing">
      {!memoryUnlocked ? <p className="ic-note">Unlocks after day {data.rollout.memory_unlock_day}.</p>
        : !enoughLearners || memory.submitted < SMALL_SAMPLE ? <InsufficientData>Recall results appear after enough learners submit recalls.</InsufficientData>
          : <MeterList label="Recall pass rate by stage" rows={memory.stages.map((stage) => ({
              name: "Day-" + stage.interval_days + " recall",
              detail: stage.submitted < SMALL_SAMPLE ? "Not enough data yet" : stage.submitted + " recalls",
              value: stage.submitted < SMALL_SAMPLE ? 0 : stage.passed, total: stage.submitted,
              figure: stage.submitted >= SMALL_SAMPLE ? stage.passed + " of " + stage.submitted + " (" + percent(stage.pass_rate) + ")" : "—",
            }))} />}
    </Section>

    <Section title="Where learners struggle and recover" id="instructor-debugging">
      <p className="ic-note">Failed tries include sample runs. A recovery is a first pass after failing with that error type.{topic ? " Showing " + topic + "." : ""}</p>
      {topics.length ? <div className="ic-gamification-frame"><RecoveryTable topics={topics} /></div> : <RecoveryTable topics={[]} />}
    </Section>

    <details className="insights-method">
      <summary>How these measures are defined</summary>
      <ul>
        <li><strong>Scope:</strong> enrolled students and published course activities, reported as class totals.</li>
        <li><strong>Learner week:</strong> counts from each learner&apos;s first practice activity.</li>
        <li><strong>Stars:</strong> ★ solved · ★★ no hint before passing · ★★★ also within 2 attempts.</li>
        <li><strong>Tried before asking:</strong> a sample run or attempt before the first hint on that challenge.</li>
        <li><strong>Recall:</strong> a pass means at least two-thirds of questions were recalled.</li>
        <li>Charts require at least {SMALL_SAMPLE} learners and observations.</li>
      </ul>
    </details>
  </div>;
}
