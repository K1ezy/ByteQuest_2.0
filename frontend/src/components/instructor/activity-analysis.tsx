"use client";

import { plural } from "@/lib/takeaway";
import { MetricCard } from "@/components/insights/metric-card";
import { PageHeader, Section, RowSkeleton, InlineError, InlineEmpty } from "./course-ui";
import { MeasureDefinitions, MeterList, UpdatedAt } from "@/components/insights/ui";
import Link from "next/link";
import { Button, useApi } from "@/components/workspace/ui";
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
    <Section title={title} className="analysis-chart">
      <MeterList label={title + " in " + axisLabel.toLowerCase()} rows={items.map(({label, count}) => ({
        name: label, value: count, total: maximum, figure: String(count),
      }))} />
      <details className="insights-table-toggle">
        <summary className="ws-touch-action">Show as table</summary>
        <div className="ws-table-wrap"><table className="ws-table analysis-table">
          <caption className="sr-only">{title}</caption>
          <thead><tr><th scope="col">Group</th><th scope="col">{axisLabel}</th></tr></thead>
          <tbody>
            {items.map(({ label, count }) => <tr key={label}><th scope="row">{label}</th><td>{count}</td></tr>)}
          </tbody>
        </table></div>
      </details>
    </Section>
  );
}

export function ActivityAnalysisView({ activityId }: { activityId: string }) {
  const { data, error, loading, reload } = useApi<ActivityAnalysis>(`/faculty/activities/${activityId}/analysis`);
  const activitiesHref = `/instructor/activities${queryString({ course: data?.course.id })}`;
  const stuckHref = `/instructor/performance${queryString({ course: data?.course.id, activity: activityId, stuck: 1 })}`;
  return (
    <div className="analysis-view">
      <Link className="ws-inline-link ws-touch-action analysis-back" href={activitiesHref}>Back to activities</Link>
      <PageHeader actions={<Button variant="outline" onClick={reload}>Refresh</Button>}
        title={data?.title ?? "Activity Analysis"}
        subtitle={data ? `${data.course.title} · ${data.activity_type === "quiz" ? "Quiz" : "Coding challenge"} · ${data.pass_mark_percent}% pass mark` : undefined}
      />
      {loading && !data && <RowSkeleton/>}
      {error && <InlineError onRetry={reload}/>}
      {data ? (
        <>
          {data.generated_at && <UpdatedAt at={data.generated_at}/>}
          <p className="ws-muted">
            {data.attempted} of {data.class_size} enrolled learners attempted this activity. {data.not_started} have yet to start.
            {data.excludes_exam_attempts ? " Figures cover graded practice only." : ""}
          </p>
          <div className="ws-stat-grid" role="group" aria-label="Activity statistics">
            <MetricCard metric="pass_rate" value={percentOrDash(data.pass_rate)}
              sentence={data.attempted ? `${data.passed} of ${plural(data.attempted, "learner", "learners")} who tried ${data.passed === 1 ? "has" : "have"} passed.` : "No learner has tried this activity yet."} />
            <MetricCard metric="first_try_pass_rate" value={percentOrDash(data.first_try_pass_rate)}
              sentence={data.first_try_pass_rate == null ? "No learner has tried this activity yet."
                : `${percentOrDash(data.first_try_pass_rate)} of learners who tried passed on their first attempt.`} />
            <MetricCard metric="median_attempts_to_pass" value={data.median_attempts_to_pass ?? "—"}
              sentence={data.median_attempts_to_pass == null ? "No learner has passed yet." : `Learners usually pass on attempt ${data.median_attempts_to_pass}.`} />
            <MetricCard metric="stuck" value={data.stuck}
              sentence={data.stuck ? `${plural(data.stuck, "learner has", "learners have")} tried ${data.stuck_after_attempts} or more times without passing.` : "No learner is stuck on this activity."}>
              {data.stuck ? <Link className="insight-practice" href={stuckHref}>Show them →</Link> : null}
            </MetricCard>
          </div><MeasureDefinitions names={["pass_rate","first_try_pass_rate","median_attempts_to_pass","stuck"]}/>
          {data.attempted ? (
            <>
              <div className="analysis-charts">
                <AnalysisChart title="Best scores" axisLabel="Learners" items={data.score_distribution} />
                {data.activity_type === "challenge" ? (
                  data.error_categories.length ? <AnalysisChart title="Errors in failed attempts" axisLabel="Attempts" items={data.error_categories} /> :
                    <Section className="analysis-chart" title="Errors in failed attempts"><p className="ws-muted">No failed attempts recorded.</p></Section>
                ) : null}
              </div>
              <Section className="analysis-chart" title="What the results suggest">
                <p>{analysisReading(data)}</p>
                {data.stuck ? <Link className="button button-outline ws-touch-action" href={stuckHref}>Stuck learners</Link> : null}
              </Section>
            </>
          ) : <InlineEmpty><strong>No attempts yet</strong> {analysisReading(data)}</InlineEmpty>}
          {data.hint_use && (data.hint_use.learners > 0 || data.attempted > 0) ? (
            <Section className="analysis-chart" title="Hint use">
              <p>{data.hint_use.learners} revealed a hint. {data.hint_use.passed} of those learners passed.</p>
            </Section>
          ) : null}
          {data.questions && data.attempted > 0 ? (
            <Section className="analysis-chart" title="First attempts by question">
              {data.questions.some((item) => item.recorded > 0) ? (
                <>
                  <p className="ws-muted">Counts include first attempts with saved answers.</p>
                  <div className="ws-table-wrap"><table className="ws-table analysis-table">
                    <caption className="sr-only">Correct responses on recorded first attempts</caption>
                    <thead><tr><th scope="col">Question</th><th scope="col">Correct</th></tr></thead>
                    <tbody>
                      {data.questions.map((question) => (
                        <tr key={question.question_id}><th scope="row">{question.prompt}</th><td>{question.correct} / {question.recorded}</td></tr>
                      ))}
                    </tbody>
                  </table></div>
                </>
              ) : <p className="ws-muted">No first-attempt answers are available for this quiz.</p>}
            </Section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
