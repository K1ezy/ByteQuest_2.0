"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button, ConfirmDialog, EmptyState, Identity, LoadingPanel, Notice,
  PageHeading, StatCard, StatusChip, useApi,
} from "@/components/workspace/ui";
import { formatDateTime } from "@/lib/workspace";

type Forecast = {
  id: string;
  target_activity: string;
  probability: number;
  predicted_pass: boolean;
  label: string;
  model_version: string;
  selected_model: string;
  as_of: string;
  actual_outcome: boolean | null;
  advisory: string;
};
type StudentRow = {
  student_id: string;
  display_name: string | null;
  username: string;
  average_score: number | null;
  latest_score: number | null;
  quiz_count: number;
  challenge_count: number;
  exam_count: number;
  forecast_status: string;
  forecast: Forecast | null;
  target_activity: string | null;
};
type HistoryEvent = { kind: string; title: string; score_percentage: number; at: string };
type Dashboard = {
  course: { title: string };
  readiness: { status: string };
  summary: { active_learners: number; graded_events: number; average_score: number | null; forecast_count: number; need_support: number };
  trend: { date: string; quiz: number | null; challenge: number | null; exam: number | null }[];
  model_quality: { labeled_predictions: number; accuracy_percent: number | null };
  students: StudentRow[];
};
type PredictionHistory = Forecast | { id: string; status: "legacy"; target_activity: string; probability: null; model_version: string; as_of: string; actual_outcome: boolean | null; label: string };
type Detail = { student: StudentRow; history: HistoryEvent[]; trend: Dashboard["trend"]; predictions: PredictionHistory[] };

const reasons: Record<string, string> = {
  no_graded_history: "No graded results yet",
  no_next_activity: "No eligible next activity",
  missing_consent: "Research consent unavailable",
  insufficient_history: "More topic history needed",
  model_unavailable: "Approved model unavailable",
  no_saved_prediction: "Awaiting a saved prediction",
};
const readinessMessages: Record<string, string> = {
  disabled: "Forecast scoring is turned off. Historical results remain available.",
  approval_required: "Forecast scoring awaits research approval. Historical results remain available.",
  artifacts_unavailable: "No approved, active model is available yet. Historical results remain available.",
  artifacts_invalid: "The active model could not be validated. Historical results remain available.",
  unavailable: "Forecast scoring is temporarily unavailable. Historical results remain available.",
};

function Trend({ points }: { points: Dashboard["trend"] }) {
  if (!points.length) return <p className="ws-muted">No graded results yet.</p>;
  const palette: Record<string, string> = { quiz: "#2563eb", challenge: "#16a34a", exam: "#ea580c" };
  const width = 600;
  const height = 160;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Average scores by day for quizzes, coding challenges and released exams" style={{ width: "100%", height: "auto" }}>
        {[0, 50, 100].map((score) => <g key={score}><line x1="32" x2="590" y1={140 - score * 1.2} y2={140 - score * 1.2} stroke="#d1d5db" /><text x="0" y={144 - score * 1.2} fontSize="11" fill="#64748b">{score}%</text></g>)}
        {(["quiz", "challenge", "exam"] as const).map((kind) => {
          const coordinates = points.map((point, index) => point[kind] === null ? null : `${32 + index * 558 / Math.max(1, points.length - 1)},${140 - point[kind]! * 1.2}`);
          return <g key={kind}>
            <polyline points={coordinates.filter(Boolean).join(" ")} fill="none" stroke={palette[kind]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {coordinates.map((point, index) => point ? <circle key={`${kind}-${index}`} cx={Number(point.split(",")[0])} cy={Number(point.split(",")[1])} r="3.5" fill={palette[kind]} /> : null)}
          </g>;
        })}
      </svg>
      <p className="ws-row-meta">{points[0].date} to {points[points.length - 1].date} · <span style={{ color: palette.quiz }}>● Quiz</span> · <span style={{ color: palette.challenge }}>● Coding</span> · <span style={{ color: palette.exam }}>● Released exam</span></p>
      <details><summary>View trend data</summary><div className="ws-table-wrap"><table className="ws-table"><thead><tr><th scope="col">Date</th><th scope="col">Quiz</th><th scope="col">Coding</th><th scope="col">Exam</th></tr></thead><tbody>{points.map((point) => <tr key={point.date}><td data-label="Date">{point.date}</td><td data-label="Quiz">{point.quiz === null ? "—" : `${point.quiz}%`}</td><td data-label="Coding">{point.challenge === null ? "—" : `${point.challenge}%`}</td><td data-label="Exam">{point.exam === null ? "—" : `${point.exam}%`}</td></tr>)}</tbody></table></div></details>
    </div>
  );
}

function MachineLearningDashboard({ courseId }: { courseId: string | null }) {
  const path = useMemo(() => courseId ? `/faculty/ml?course_id=${encodeURIComponent(courseId)}` : null, [courseId]);
  const { data, error, loading, reload } = useApi<Dashboard>(path);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequest = useRef(0);

  async function openStudent(studentId: string) {
    const requestId = ++detailRequest.current;
    setSelected(studentId);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const response = await apiRequest<Detail>(`/faculty/ml/students/${studentId}?course_id=${encodeURIComponent(courseId || "")}`);
      if (requestId === detailRequest.current) setDetail(response);
    } catch (caught) {
      if (requestId === detailRequest.current) setDetailError(getErrorMessage(caught));
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  }

  return <>
    <PageHeading eyebrow="FACULTY WORKSPACE" title="Machine Learning"
      description="Past course results and advisory predictions for the next activity. Forecasts never change grades or student access."
      actions={<Button variant="outline" onClick={reload}>Refresh</Button>} />
    {error ? <Notice tone="error">Machine Learning could not load. {error}</Notice> : null}
    {loading && !data ? <LoadingPanel label="Loading Machine Learning dashboard…" /> : null}
    {data ? <>
      {data.readiness.status !== "ready" ? <Notice tone="info">Forecasts are unavailable: {readinessMessages[data.readiness.status] || readinessMessages.unavailable}</Notice> : null}
      <div className="ws-stat-grid" aria-label="Machine Learning summary">
        <StatCard label="Active learners" value={data.summary.active_learners} hint="Enrolled in this course" icon="◉" />
        <StatCard label="Graded results" value={data.summary.graded_events} hint="Quiz, coding and released exam results" icon="▦" />
        <StatCard label="Average score" value={data.summary.average_score === null ? "—" : `${data.summary.average_score}%`} hint="Across visible graded results" icon="↗" />
        <StatCard label="Current forecasts" value={data.summary.forecast_count} hint="Saved forecasts for next activities" icon="◇" />
      </div>
      <section className="ws-panel" aria-labelledby="ml-trend-title"><div className="ws-panel-head ml-panel-head"><div><p className="eyebrow-label">PAST PERFORMANCE</p><h2 id="ml-trend-title">Class score trend</h2></div><Link className="ws-text-link" href="/faculty/performance">Open detailed Performance →</Link></div><Trend points={data.trend} /></section>
      <section className="ws-panel" aria-labelledby="ml-quality-title"><div className="ws-panel-head"><div><p className="eyebrow-label">MODEL QUALITY</p><h2 id="ml-quality-title">Observed prediction accuracy</h2></div></div><p>{data.model_quality.accuracy_percent === null ? "No predictions have a later observed outcome in this course." : `${data.model_quality.accuracy_percent}% across ${data.model_quality.labeled_predictions} labeled predictions in this course.`}</p></section>
      <section aria-labelledby="ml-students-title"><h2 id="ml-students-title">Learner outlook</h2>
        {data.students.length === 0 ? <EmptyState title="No students enrolled yet">An administrator can enroll students in this course.</EmptyState> :
          <div className="ws-table-wrap"><table className="ws-table"><caption className="sr-only">Course learner results and next-activity forecasts</caption><thead><tr><th>Learner</th><th>Past results</th><th>Latest score</th><th>Next activity</th><th>Forecast</th><th>Action</th></tr></thead><tbody>{data.students.map((student) => <tr key={student.student_id}>
            <td data-label="Learner"><Identity displayName={student.display_name} username={student.username} pseudonym={student.student_id} /></td>
            <td data-label="Past results">{student.quiz_count} quizzes · {student.challenge_count} coding · {student.exam_count} exams</td>
            <td data-label="Latest score">{student.latest_score === null ? "—" : `${student.latest_score}%`}</td>
            <td data-label="Next activity">{student.target_activity || "—"}</td>
            <td data-label="Forecast">{student.forecast ? <><StatusChip state="ready" label={student.forecast.label} tone="info" /><span className="ws-row-meta">{Math.round(student.forecast.probability * 100)}% · {student.forecast.model_version} · {formatDateTime(student.forecast.as_of)}</span></> : <span className="ws-muted">{reasons[student.forecast_status] || "Unavailable"}</span>}</td>
            <td data-label="Action"><Button variant="outline" onClick={() => void openStudent(student.student_id)}>View history</Button></td>
          </tr>)}</tbody></table></div>}
      </section>
    </> : null}
    <ConfirmDialog open={Boolean(selected)} title={detail ? `${detail.student.display_name || `@${detail.student.username}`} · learning history` : "Learning history"} confirmLabel="Close" hideConfirm onCancel={() => setSelected(null)}>
      {detailLoading ? <LoadingPanel label="Loading learner history…" /> : null}
      {detailError ? <Notice tone="error">{detailError}</Notice> : null}
      {detail ? <div className="ws-student-detail">
        <h3>Current outlook</h3>{detail.student.forecast ? <dl className="ws-summary-list">
          <div><dt>Next activity</dt><dd>{detail.student.forecast.target_activity}</dd></div>
          <div><dt>Pass probability</dt><dd>{Math.round(detail.student.forecast.probability * 100)}% · {detail.student.forecast.label}</dd></div>
          <div><dt>Predicted outcome</dt><dd>{detail.student.forecast.predicted_pass ? "Pass" : "Not pass"}</dd></div>
          <div><dt>Model</dt><dd>{detail.student.forecast.model_version} · {detail.student.forecast.selected_model === "logreg" ? "Logistic regression" : "Random forest"}</dd></div>
          <div><dt>Forecast date</dt><dd>{formatDateTime(detail.student.forecast.as_of)}</dd></div>
          <div><dt>Observed outcome</dt><dd>{detail.student.forecast.actual_outcome === null ? "Pending" : detail.student.forecast.actual_outcome ? "Passed" : "Not passed"}</dd></div>
          <div><dt>Use</dt><dd>{detail.student.forecast.advisory}</dd></div>
        </dl> : <p>{reasons[detail.student.forecast_status] || "Unavailable"}</p>}
        <h3>Personal score trend</h3><Trend points={detail.trend || []} />
        <h3>Past results</h3>{detail.history.length ? <ul className="ws-compact-list">{detail.history.map((event, index) => <li key={`${event.at}-${index}`}><strong>{event.title}</strong><span>{event.kind === "exam" ? "Released exam" : event.kind === "quiz" ? "Quiz" : "Coding challenge"} · {event.score_percentage}% · {formatDateTime(event.at)}</span></li>)}</ul> : <p>No graded results yet.</p>}
        <h3>Saved forecast history</h3>{detail.predictions.length ? <ul className="ws-compact-list">{detail.predictions.map((prediction) => <li key={prediction.id}><strong>{prediction.target_activity}: {prediction.probability === null ? prediction.label : `${Math.round(prediction.probability * 100)}%`}</strong><span>{formatDateTime(prediction.as_of)} · {prediction.model_version} · {prediction.actual_outcome === null ? "Outcome pending" : prediction.actual_outcome ? "Passed" : "Not passed"}</span></li>)}</ul> : <p>No eligible saved forecasts.</p>}
      </div> : null}
    </ConfirmDialog>
  </>;
}

export default function Page() {
  return <WorkspaceSuspense label="Machine Learning"><CourseDashboard /></WorkspaceSuspense>;
}

function CourseDashboard() {
  const { courseId } = useWorkspace();
  return <MachineLearningDashboard key={courseId || "no-course"} courseId={courseId} />;
}
