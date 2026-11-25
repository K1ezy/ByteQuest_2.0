"use client";

import { useState } from "react";
import { PageHeader } from "@/components/instructor/course-ui";
import { Button, LoadingPanel, Notice, useApi } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { formatDateTime } from "@/lib/workspace";

const bands = {
  advance_next_level: ["Advance", "≥ 0.60", "Consider assigning the next challenge based on earlier activity.", "advance"],
  standard_next: ["Standard Practice", "0.40 to < 0.60", "Continue with regular practice on the current path.", "standard"],
  remedial_practice: ["Remedial Practice", "< 0.40", "Consider extra practice, a review, or individual feedback.", "remedial"],
} as const;

const metrics = [
  ["prior_attempt_count", "Prior Attempt Count", "Number of graded attempts before this assignment.", "attempts"],
  ["prior_pass_rate", "Prior Pass Rate", "Share of earlier graded attempts that passed.", "%"],
  ["prior_mean_score_ratio", "Mean Prior Score", "Average of the scores on earlier graded attempts.", "%"],
  ["recent_3_pass_rate", "Pass Rate (Last 3)", "Share of up to three most recent graded attempts that passed.", "%"],
  ["prior_compile_error_rate", "Prior Compilation Error Rate", "Share of earlier coding attempts with a compilation error.", "%"],
  ["prior_runtime_error_rate", "Prior Runtime Error Rate", "Share of earlier coding attempts with a runtime error or timeout.", "%"],
  ["mean_attempts_per_task", "Mean Attempts Per Task", "Average number of earlier graded attempts per activity attempted.", ""],
  ["prior_quiz_score_mean", "Mean Prior Quiz Score", "Average score on earlier graded quizzes.", "percent"],
  ["prior_hint_usage_rate", "Prior Hint Usage Rate", "Earlier hint reveals divided by the number of distinct tasks attempted.", "%"],
  ["days_since_last_attempt", "Days Since Last Attempt", "Time between the most recent graded attempt and when this task was assigned.", "days"],
] as const;

type Prediction = {
  snapshot_id: string; assigned_at: string; school_id: string; student_name: string;
  task: string; prior_completed: number; prob_lr: number; label_lr: boolean; prob_rf: number; label_rf: boolean;
  advisory_band: keyof typeof bands; model_version: string; selected_model: string;
  features: Record<string, number | null>;
};
type Report = {
  readiness: { status: string; active_model_version: string | null };
  selected_model: string | null; decision_threshold: number;
  students: { id: string; school_id: string; name: string }[];
  rows: Prediction[];
};

const modelName = (model: string) => model === "logreg" ? "Logistic Regression" : "Random Forest";
const label = (passed: boolean) => passed ? "Predicted Pass" : "Predicted Not Pass";
const columns = ["Student ID", "Assigned Task", "Prior Progress", "Logistic Regression", "Random Forest", "Advisory Band", "Snapshot ID"];

function displayMetric(value: number | null | undefined, unit: string) {
  if (value == null) return "No history";
  if (unit === "%") return `${(value * 100).toFixed(1)}%`;
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return `${Number(value.toFixed(1))}${unit ? ` ${unit}` : ""}`;
}

function exportPredictions(rows: Prediction[]) {
  const escape = (value: string) => `"${(/^[\s=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  const csv = [columns, ...rows.map((row) => [row.school_id, row.task, `${row.prior_completed} completed`,
    `${row.prob_lr.toFixed(2)} (${label(row.label_lr)})`, `${row.prob_rf.toFixed(2)} (${label(row.label_rf)})`,
    bands[row.advisory_band][0], row.snapshot_id])].map((values) => values.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "bytequest-predictions.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Predictions({ courseId }: { courseId: string }) {
  const { courses, setCourse } = useWorkspace();
  const [student, setStudent] = useState("");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState("");
  const filters = new URLSearchParams({ course_id: courseId });
  if (student) filters.set("student_id", student);
  if (from) filters.set("from_date", from);
  if (through) filters.set("through_date", through);
  const invalidDates = Boolean(from && through && from > through);
  const { data, loading, error, reload } = useApi<Report>(invalidDates ? null : `/faculty/ml/predictions?${filters}`, true);
  const query = search.trim().toLocaleLowerCase();
  const rows = (loading || error || invalidDates ? [] : data?.rows ?? []).filter((row) =>
    !query || [row.school_id, row.student_name, row.task, row.snapshot_id].some((value) => value.toLocaleLowerCase().includes(query)));
  const selected = rows.find((row) => row.snapshot_id === selection) ?? rows[0];

  return <div className="ic-activity-shell predictions-page">
    <PageHeader title="Performance and Predictions" />
    <section className="ws-panel predictions-filters" aria-label="Prediction filters">
      <label>Course<select value={courseId} onChange={(event) => setCourse(event.target.value)}>
        {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
      </select></label>
      <label>Student<select value={student} onChange={(event) => setStudent(event.target.value)}>
        <option value="">All students</option>
        {data?.students.map((item) => <option key={item.id} value={item.id}>{item.school_id} · {item.name}</option>)}
      </select></label>
      <fieldset><legend>Date range</legend>
        <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Through<input type="date" value={through} onChange={(event) => setThrough(event.target.value)} /></label>
      </fieldset>
      <p className="predictions-model">Model Version <strong>{data?.readiness.active_model_version ?? "Unavailable"}</strong>
        {data?.selected_model && <> · Selected {modelName(data.selected_model)}</>}
        {data && <> · Threshold {data.decision_threshold.toFixed(2)}</>}</p>
    </section>
    {invalidDates && <Notice tone="error">Choose an end date on or after the start date.</Notice>}
    <section className="predictions-legend" aria-labelledby="predictions-legend-title">
      <h2 id="predictions-legend-title">Advisory Band Legend</h2>
      {Object.values(bands).map(([name, range, explanation, tone]) => <div className="ws-panel" key={name}>
        <span className={`predictions-band ${tone}`} tabIndex={0} data-tooltip={`${name} (${range}). ${explanation}`}>{name} ({range})</span>
      </div>)}
    </section>
    <div className="predictions-results">
      <section className="ws-panel predictions-table-panel" aria-labelledby="predictions-table-title">
        <h2 id="predictions-table-title">Pre-Submission Dual-Model Predictions (Snapshot at t₀)</h2>
        <div className="predictions-table-controls">
          <label>Search predictions<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <Button disabled={!rows.length} onClick={() => exportPredictions(rows)}>Export CSV</Button>
        </div>
        {error ? <Notice tone="error">{error} <Button onClick={reload}>Retry</Button></Notice>
          : loading && !invalidDates ? <LoadingPanel label="Loading predictions…" />
          : rows.length ? <div className="predictions-table-scroll" tabIndex={0} aria-label="Scrollable predictions table">
            <table className="ws-table predictions-table">
              <thead><tr>{columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead>
              <tbody>{rows.map((row) => {
                const band = bands[row.advisory_band];
                return <tr key={row.snapshot_id} className={selected?.snapshot_id === row.snapshot_id ? "is-selected" : ""}
                  onClick={() => setSelection(row.snapshot_id)}>
                  <th scope="row"><span tabIndex={0} data-tooltip={row.student_name}>{row.school_id}</span></th>
                  <td>{row.task}</td><td>{row.prior_completed} completed</td>
                  <td><strong>{row.prob_lr.toFixed(2)}</strong><small>{label(row.label_lr)}</small></td>
                  <td><strong>{row.prob_rf.toFixed(2)}</strong><small>{label(row.label_rf)}</small></td>
                  <td><span className={`predictions-band ${band[3]}`} tabIndex={0} data-tooltip={band[2]}>{band[0]}</span></td>
                  <td><button className="ws-inline-link" type="button" aria-pressed={selected?.snapshot_id === row.snapshot_id}
                    aria-label={`View snapshot ${row.snapshot_id}`} onClick={() => setSelection(row.snapshot_id)}>
                    {row.snapshot_id}
                  </button></td>
                </tr>;
              })}</tbody>
            </table>
          </div> : !invalidDates && <p>{query ? "No predictions match your search."
            : data?.readiness.status === "ready" ? "No assignment-time predictions match these filters."
              : "No saved assignment-time predictions are available. New predictions require an approved active model."}</p>}
      </section>
      <aside className="ws-panel predictions-snapshot" aria-labelledby="predictions-snapshot-title">
        <h2 id="predictions-snapshot-title">Snapshot Context</h2>
        <p className="ws-muted">10 prior-activity features saved at assignment time.</p>
        {selected ? <>
          <p className="ws-muted">{formatDateTime(selected.assigned_at)} · {modelName(selected.selected_model)} · {selected.model_version}</p>
          <dl>{metrics.map(([key, name, explanation, unit]) => <div key={key}>
            <dt><span tabIndex={0} data-tooltip={explanation}>{name}</span></dt>
            <dd>{displayMetric(selected.features[key], unit)}</dd>
          </div>)}</dl>
        </> : <p>Choose a prediction to see its snapshot.</p>}
      </aside>
    </div>
  </div>;
}

export default function Page() {
  const { courseId } = useWorkspace();
  return courseId ? <Predictions key={courseId} courseId={courseId} /> : null;
}
