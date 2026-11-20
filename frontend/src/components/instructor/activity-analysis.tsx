"use client";

import Link from "next/link";
import { Button, EmptyState, LoadingPanel, Notice, PageHeading, StatCard, useApi } from "@/components/workspace/ui";
import { queryString, type ActivityAnalysis } from "@/lib/workspace";

const percent = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });
const percentOrDash = (value: number | null) => value === null ? "—" : percent.format(value);
const errorReadings: Record<string, string> = {
  logic_error: "Check how students interpret the expected output format.",
  syntax_error: "Walk through a short example and show how to read compiler messages.",
  runtime_error: "Review input handling and common runtime failures with the class.",
  timeout: "Review the task’s time limit and compare approaches on larger inputs.",
};

export function analysisReading(data: ActivityAnalysis): string {
  if (!data.attempted) return "A class summary will be available after the first graded practice attempt.";
  const [top, next] = data.error_categories;
  if (top && top.count > (next?.count ?? 0) && Object.hasOwn(errorReadings, top.category)) {
    return `${top.label} was the most frequent error. ${errorReadings[top.category]}`;
  }
  if (data.stuck) return "Some learners have tried several times without a pass. Review their recent attempts in Student Progress.";
  if (data.passed === data.attempted) return "Every learner who attempted this activity has passed.";
  return "Use the score distribution to see where learners may need more practice.";
}

function AnalysisChart({ title, axisLabel, items }: {
  title: string;
  axisLabel: string;
  items: { label: string; count: number }[];
}) {
  const maximum = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="ws-panel analysis-chart" aria-label={title}>
      <h2>{title}</h2>
      <ul className="insights-meters" aria-label={`${title} in ${axisLabel.toLowerCase()}`}>
        {items.map(({ label, count }) => (
          <li key={label}>
            <strong className="insights-meter-name">{label}</strong>
            <span className="insights-meter-track" aria-hidden="true">
              <span className="insights-meter-fill" style={{ width: `${count / maximum * 100}%` }} />
            </span>
            <span className="insights-meter-figure">{count}</span>
          </li>
        ))}
      </ul>
      <details className="insights-table-toggle">
        <summary className="ws-touch-action">Show as table</summary>
        <table className="ws-table analysis-table">
          <caption className="sr-only">{title}</caption>
          <thead><tr><th scope="col">Group</th><th scope="col">{axisLabel}</th></tr></thead>
          <tbody>
            {items.map(({ label, count }) => <tr key={label}><th scope="row">{label}</th><td>{count}</td></tr>)}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export function ActivityAnalysisView({ activityId }: { activityId: string }) {
  const { data, error, loading, reload } = useApi<ActivityAnalysis>(`/faculty/activities/${activityId}/analysis`);
  const activitiesHref = `/instructor/activities${queryString({ course: data?.course.id })}`;
  const stuckHref = `/instructor/performance${queryString({ course: data?.course.id, activity: activityId, stuck: 1 })}`;
  return (
    <div className="analysis-view">
      <Link className="ws-inline-link ws-touch-action analysis-back" href={activitiesHref}>Back to activities</Link>
      <PageHeading
        eyebrow="ACTIVITY ANALYSIS"
        title={data?.title ?? "Activity Analysis"}
        description={data ? `${data.course.title} · ${data.activity_type === "quiz" ? "Quiz" : "Coding challenge"} · ${data.pass_mark_percent}% pass mark` : undefined}
      />
      {loading && !data ? <LoadingPanel label="Loading activity analysis…" /> : null}
      {error ? (
        <Notice tone="error">
          {error} <Button className="ws-touch-action" variant="outline" onClick={reload}>Retry</Button>
        </Notice>
      ) : null}
      {data ? (
        <>
          <p className="ws-muted">
            {data.attempted} of {data.class_size} enrolled learners attempted this activity. {data.not_started} have yet to start.
            {data.excludes_exam_attempts ? " Figures cover graded practice only." : ""}
          </p>
          <div className="ws-stat-grid" aria-label="Activity summary">
            <StatCard label="Pass rate" value={percentOrDash(data.pass_rate)} hint={`${data.passed} of ${data.attempted} who attempted`} />
            <StatCard label="First-try pass rate" value={percentOrDash(data.first_try_pass_rate)} hint="Of learners who attempted" />
            <StatCard label="Median attempts to pass" value={data.median_attempts_to_pass ?? "—"} hint="Among learners who passed" />
            <StatCard label="Stuck" value={data.stuck} hint={`${data.stuck_after_attempts}+ attempts without a pass`} tone={data.stuck ? "wait" : "info"} />
          </div>
          {data.attempted ? (
            <>
              <div className="analysis-charts">
                <AnalysisChart title="Best scores" axisLabel="Learners" items={data.score_distribution} />
                {data.activity_type === "challenge" ? (
                  data.error_categories.length ? <AnalysisChart title="Errors in failed attempts" axisLabel="Attempts" items={data.error_categories} /> :
                    <section className="ws-panel analysis-chart"><h2>Errors in failed attempts</h2><p className="ws-muted">No failed attempts recorded.</p></section>
                ) : null}
              </div>
              <section className="ws-panel analysis-chart" aria-label="How to read the results">
                <h2>What the results suggest</h2>
                <p>{analysisReading(data)}</p>
                {data.stuck ? <Link className="button button-outline ws-touch-action" href={stuckHref}>Stuck learners</Link> : null}
              </section>
            </>
          ) : <EmptyState title="No attempts yet">{analysisReading(data)}</EmptyState>}
          {data.hint_use && (data.hint_use.learners > 0 || data.attempted > 0) ? (
            <section className="ws-panel analysis-chart">
              <h2>Hint use</h2>
              <p>{data.hint_use.learners} revealed a hint. {data.hint_use.passed} of those learners passed.</p>
            </section>
          ) : null}
          {data.questions && data.attempted > 0 ? (
            <section className="ws-panel analysis-chart">
              <h2>First attempts by question</h2>
              {data.questions.some((item) => item.recorded > 0) ? (
                <>
                  <p className="ws-muted">Counts include first attempts with saved answers.</p>
                  <table className="ws-table analysis-table">
                    <caption className="sr-only">Correct responses on recorded first attempts</caption>
                    <thead><tr><th scope="col">Question</th><th scope="col">Correct</th></tr></thead>
                    <tbody>
                      {data.questions.map((question) => (
                        <tr key={question.question_id}><th scope="row">{question.prompt}</th><td>{question.correct} / {question.recorded}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : <p className="ws-muted">No first-attempt answers are available for this quiz.</p>}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
