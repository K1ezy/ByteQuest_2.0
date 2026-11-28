"use client";

import { notEnoughData, plural } from "@/lib/takeaway";
import { MetricCard } from "@/components/insights/metric-card";
import { MeasureDefinitions, MeterList, NotEnoughData, SMALL_SAMPLE } from "@/components/insights/ui";
import EngagementChart from "./engagement-chart";
import { StatusChip } from "@/components/workspace/ui";
import { Section } from "./course-ui";

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


const percent = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)}%`);
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

export function GamificationInsightsView({ data, topic }: { data: GamificationInsightsData; topic?: string | null }) {
  const { solve_quality: quality, help_seeking: help, memory } = data;
  const codexWeek = Math.floor(data.rollout.codex_unlock_day / 7);
  const memoryWeek = Math.floor(data.rollout.memory_unlock_day / 7);
  const enoughLearners = data.active >= SMALL_SAMPLE;
  const showEngagement = enoughLearners && data.weekly.filter((point) => point.eligible >= SMALL_SAMPLE && point.events >= SMALL_SAMPLE).length >= SMALL_SAMPLE;
  const memoryUnlocked = memory.submitted > 0 || data.weekly.some((point) => point.week >= memoryWeek && point.eligible > 0);
  const topics = topic ? data.topics.filter((row) => row.topic === topic) : data.topics;

  return <div className="insights-view">
    <div className="ws-stat-grid" role="group" aria-label="Gamification statistics">
      <MetricCard metric="practised" value={data.active}
        sentence={`${data.active} of ${plural(data.enrolled, "learner", "learners")} ${data.active === 1 ? "has" : "have"} practised.`} />
      <MetricCard metric="self_solved" value={enoughLearners && quality.solved >= SMALL_SAMPLE ? percent(quality.self_solved_rate) : "—"}
        sentence={enoughLearners && quality.solved >= SMALL_SAMPLE
          ? `${percent(quality.self_solved_rate)} of ${plural(quality.solved, "solved challenge was", "solved challenges were")} passed without opening a hint.`
          : notEnoughData(quality.solved)} />
      <MetricCard metric="tried_before_asking" value={enoughLearners && help.hinted >= SMALL_SAMPLE ? percent(help.rate) : "—"}
        sentence={enoughLearners && help.hinted >= SMALL_SAMPLE
          ? `${help.tried_before_hint} of ${plural(help.hinted, "hinted challenge", "hinted challenges")} had a run or attempt before the first hint.`
          : notEnoughData(help.hinted)} />
      <MetricCard metric="recall_pass_rate" value={enoughLearners && memory.submitted >= SMALL_SAMPLE ? percent(memory.pass_rate) : "—"}
        sentence={enoughLearners && memory.submitted >= SMALL_SAMPLE
          ? `${percent(memory.pass_rate)} of ${plural(memory.submitted, "recall", "recalls")} passed.`
          : notEnoughData(memory.submitted)} />
    </div>

    <Section title="Learners active each week">
      <p className="ic-note">Weeks count from each learner&apos;s first activity.{data.weekly.length >= 6 ? " A dip around weeks 4–6 is the documented novelty effect." : ""}</p>
      {showEngagement ? <>
        <div className="ic-gamification-frame"><EngagementChart weeks={data.weekly} codexWeek={codexWeek} memoryWeek={memoryWeek} /></div>
      </> : <NotEnoughData>Weekly practice trends appear after enough learners and weeks are recorded.</NotEnoughData>}
    </Section>

    <Section title="How challenges were solved">
      {enoughLearners && quality.solved >= SMALL_SAMPLE ? (
        <MeterList label="Solved challenges by stars" rows={STAR_ROWS.map((row) => {
          const value = quality.stars[String(row.stars)] ?? 0;
          return { name: row.name, detail: row.detail, value, total: quality.solved,
            figure: value + " (" + percent(value / quality.solved) + ")" };
        })} />
      ) : <NotEnoughData>Challenge solve quality appears after enough successful submissions.</NotEnoughData>}
      {enoughLearners && help.hinted >= SMALL_SAMPLE ? <p className="ic-note">Tried before asking: {help.tried_before_hint} of {help.hinted} hinted challenges had a run or attempt before the first hint.</p> : null}
    </Section>

    <Section title="Recall retention by spacing">
      {!memoryUnlocked ? <p className="ic-note">Unlocks after day {data.rollout.memory_unlock_day}.</p>
        : !enoughLearners || memory.submitted < SMALL_SAMPLE ? <NotEnoughData>Recall results appear after enough learners submit recalls.</NotEnoughData>
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

    <MeasureDefinitions names={["tried_before_asking", "recall_pass_rate", "self_solved"]}>
        <li><strong>Scope:</strong> enrolled students and published course activities, reported as class totals.</li>
        <li><strong>Learner week:</strong> counts from each learner&apos;s first practice activity.</li>
        <li><strong>Stars:</strong> ★ solved · ★★ no hint before passing · ★★★ also within 2 attempts.</li>
        <li>Charts require at least {SMALL_SAMPLE} learners and observations.</li>
    </MeasureDefinitions>
  </div>;
}
