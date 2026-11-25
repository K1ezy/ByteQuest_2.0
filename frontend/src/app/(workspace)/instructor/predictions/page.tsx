"use client";

import { useState } from "react";
import { useActivityWorkshops } from "@/components/instructor/activity-destination";
import { PageHeader } from "@/components/instructor/course-ui";
import { Button, LoadingPanel, Notice, useApi } from "@/components/workspace/ui";
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
  workshop_id: string;
  demo_model_version?: string;
  readiness: { status: string; active_model_version: string | null };
  selected_model: string | null; decision_threshold: number;
  students: { id: string; school_id: string; name: string }[];
  rows: Prediction[];
};
type WorkshopProgress = {
  activities: { id: string }[];
  students: { id: string; display_name: string | null; username: string; states: Record<string, string>; completion_percent: number }[];
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

function exportPredictions(rows: Prediction[], isDemo: boolean) {
  const escape = (value: string) => `"${(/^[\s=+\-@]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  const headings = isDemo ? [...columns, "Data source", "Student name", "Assigned at (UTC)", "Model version", ...metrics.map((metric) => metric[0])] : columns;
  const values = rows.map((row) => {
    const cells = [row.school_id, row.task, `${row.prior_completed} completed`,
      `${row.prob_lr.toFixed(2)} (${label(row.label_lr)})`, `${row.prob_rf.toFixed(2)} (${label(row.label_rf)})`,
      bands[row.advisory_band][0], row.snapshot_id];
    if (isDemo) cells.push("Synthetic demo", row.student_name, row.assigned_at, row.model_version,
      ...metrics.map(([key]) => row.features[key]?.toString() ?? ""));
    return cells;
  });
  const csv = [headings, ...values].map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = isDemo ? "bytequest-demo-predictions.csv" : "bytequest-predictions.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function WorkshopPerformance({ workshopId }: { workshopId: string }) {
  const { data, loading, error, reload } = useApi<WorkshopProgress>(`/workshops/${workshopId}/progress`, true);
  return <section className="ws-panel predictions-class" aria-labelledby="predictions-class-title">
    <h2 id="predictions-class-title">Workshop progress</h2>
    {loading ? <LoadingPanel label="Loading Workshop progress…" />
      : error ? <Notice tone="error">{error} <Button onClick={reload}>Retry progress</Button></Notice>
      : data && <>
        <p className="ws-muted" role="status">{data.students.length} {data.students.length === 1 ? "student" : "students"} · {data.activities.length} {data.activities.length === 1 ? "activity" : "activities"}</p>
        {data.students.length === 0 ? <p>No students have joined this Workshop.</p>
          : <div className="predictions-class-scroll" tabIndex={0} role="region" aria-label="Workshop student progress">
            <table className="predictions-class-table">
              <thead><tr><th scope="col">Student</th><th scope="col">Practice progress</th></tr></thead>
              <tbody>{data.students.map((student) => <tr key={student.id}>
                <th scope="row">{student.display_name || `@${student.username}`}</th>
                <td>{data.activities.length ? <>
                  {Object.values(student.states).filter((state) => state === "solved").length} of {data.activities.length} completed
                  {" · "}<span>{student.completion_percent}%</span>
                </> : "—"}</td>
              </tr>)}</tbody>
            </table>
          </div>}
      </>}
  </section>;
}

export default function Page() {
  const { workshops, loading: workshopsLoading, error: workshopsError, reload: reloadWorkshops } = useActivityWorkshops();
  const [selectedWorkshop, setSelectedWorkshop] = useState("");
  const [student, setStudent] = useState("");
  const [from, setFrom] = useState("");
  const [through, setThrough] = useState("");
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState("");
  const workshopId = selectedWorkshop || workshops[0]?.id || "";
  const filters = new URLSearchParams({ workshop_id: workshopId });
  if (student) filters.set("student_id", student);
  if (from) filters.set("from_date", from);
  if (through) filters.set("through_date", through);
  const invalidDates = Boolean(from && through && from > through);
  const { data, loading, error, reload } = useApi<Report>(workshopId && !invalidDates ? `/faculty/ml/predictions?${filters}` : null, true);
  const report = data?.workshop_id === workshopId ? data : null;
  const query = search.trim().toLocaleLowerCase();
  const rows = (loading || error || invalidDates ? [] : report?.rows ?? []).filter((row) =>
    !query || [row.school_id, row.student_name, row.task, row.snapshot_id].some((value) => value.toLocaleLowerCase().includes(query)));
  const selected = rows.find((row) => row.snapshot_id === selection) ?? rows[0];

  if (!workshopId) return <div className="ic-activity-shell predictions-page">
    <PageHeader title="Performance and Predictions" />
    {workshopsLoading ? <LoadingPanel label="Loading Workshops…" />
      : workshopsError ? <Notice tone="error">Could not load Workshops. <Button onClick={reloadWorkshops}>Retry Workshops</Button></Notice>
      : <p className="ws-panel">You don’t manage any active Workshops yet.</p>}
  </div>;

  return <div className="ic-activity-shell predictions-page">
    <PageHeader title="Performance and Predictions" />
    <section className="ws-panel predictions-filters" aria-label="Prediction filters">
      <label>Workshop<select value={workshopId}
        onChange={(event) => {
          setSelectedWorkshop(event.target.value);
          setStudent("");
          setSearch("");
          setSelection("");
        }}>
        {workshops.map((workshop) => <option key={workshop.id} value={workshop.id}>
          {workshop.name}{workshop.block ? ` · Block ${workshop.block}` : ""}
        </option>)}
      </select></label>
      <label>Student<select value={student} disabled={!report || !report.students.length} onChange={(event) => setStudent(event.target.value)}>
        <option value="">All students</option>
        {report?.students.map((item) => <option key={item.id} value={item.id}>{item.school_id} · {item.name}</option>)}
      </select></label>
      <fieldset><legend>Date range</legend>
        <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Through<input type="date" value={through} onChange={(event) => setThrough(event.target.value)} /></label>
      </fieldset>
      <p className="predictions-model">{report?.demo_model_version ? "Demo model" : "Model Version"}{" "}
        <strong>{report?.demo_model_version ?? report?.readiness.active_model_version ?? "Unavailable"}</strong>
        {report?.selected_model && <> · Selected {modelName(report.selected_model)}</>}
        {report && <> · Threshold {report.decision_threshold.toFixed(2)}</>}</p>
    </section>
    <WorkshopPerformance key={workshopId} workshopId={workshopId} />
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
        {report?.demo_model_version && <Notice tone="info"><strong>Synthetic demo predictions.</strong>{" "}
          These scores use development models and simulated student histories for the presentation.</Notice>}
        <div className="predictions-table-controls">
          <label>Search predictions<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <Button disabled={!rows.length} onClick={() => exportPredictions(rows, Boolean(report?.demo_model_version))}>Export CSV</Button>
        </div>
        {error ? <Notice tone="error">{error} <Button onClick={reload}>Retry</Button></Notice>
          : !invalidDates && (loading || !report) ? <LoadingPanel label="Loading predictions…" />
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
            : report?.demo_model_version || report?.readiness.status === "ready" ? "No assignment-time predictions match these filters."
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
