import { InsightLineChart } from "@/components/insights/line-chart";
import { MIN_SAMPLE, trendTakeaway } from "@/lib/takeaway";
import { formatDateTime } from "@/lib/workspace";
import { isLegacy, type SavedForecast, type StudentRow, type TrendPoint, type Detail, FORECAST_REASONS, TEACHING_ACTIONS } from "../ml/types";

const scoreSeries = [
  { key: "quiz", label: "Quiz", token: "var(--chart-series)" },
  { key: "challenge", label: "Coding challenge", token: "var(--chart-series-2)", dash: "7 4" },
  { key: "exam", label: "Released exam", token: "var(--chart-series-3)", dash: "2 4" },
];
const counted: Record<string, string> = { quiz: "attempt", challenge: "attempt", exam: "exam submission" };
/** "66.7% average · 12 attempts". The tooltip and the table share it so they always agree. */
export function scoreText(kind: string, point: Record<string, unknown>): string {
  const average = point[kind];
  const count = Number(point[kind + "_count"] ?? 0);
  return average == null ? "no results"
    : `${average}% average · ${count} ${counted[kind]}${count === 1 ? "" : "s"}${count < MIN_SAMPLE ? " (too few to trust)" : ""}`;
}

/** A point built from fewer than MIN_SAMPLE results is faded, never hidden. */
const resultCount = (p: Record<string, unknown>) => scoreSeries.reduce((n, s) => n + Number(p[s.key + "_count"] ?? 0), 0);

export function Trend({ points, events, timezone, label, scale }: {points: TrendPoint[]; events:number; timezone:string; label:string;
  /** Set for the class trend: weekly or daily first-try averages with a takeaway title. */ scale?: "weekly" | "daily"}) {
  if (!points.length) return <p>No graded results in this period.</p>;
  if (scale) {
    const trusted = points.filter(p => Number(p.challenge_count ?? 0) >= MIN_SAMPLE && p.challenge != null).map(p => Number(p.challenge));
    const takeaway = trendTakeaway(trusted, "First-try challenge scores");
    const bucket = scale === "weekly" ? "Week of " : "";
    return <>
      <h3 className="metric-card-sentence">{takeaway}</h3>
      <InsightLineChart rows={points.map(p => ({ ...p, x: Date.parse(p.date) }))}
        label={label} summary={takeaway + " First-try averages per " + (scale === "weekly" ? "week" : "day") + " in " + timezone + "; faded points have fewer than " + MIN_SAMPLE + " results."}
        series={scoreSeries} numericX domain={[0,100]} xLabel={scale === "weekly" ? "Week starting" : "Date"}
        formatX={x => new Date(Number(x)).toISOString().slice(0,10)}
        pointState={row => resultCount(row) < MIN_SAMPLE ? "faded" : undefined}
        pointLegend={"Faded points: fewer than " + MIN_SAMPLE + " results"}
        tooltip={{ title: row => bucket + new Date(Number(row.x)).toISOString().slice(0,10), value: (s, row) => scoreText(s.key, row) }} />
    </>;
  }
  const day = (x: string | number) => new Date(Number(x)).toLocaleDateString("en-US",
    { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: timezone }) + ` (${timezone} day)`;
  return <InsightLineChart rows={points.map(p => ({ ...p, x: Date.parse(p.date) }))}
    label={label} summary={events + " recorded results, daily averages in " + timezone + ". Repeated attempts count as separate recorded results."}
    series={scoreSeries} numericX domain={[0,100]} xLabel="Date" formatX={x => new Date(Number(x)).toISOString().slice(0,10)}
    tooltip={{ title: row => day(row.x), value: (s, row) => scoreText(s.key, row) }}
    table={<table className="ws-table analysis-table"><caption>{label}</caption>
      <thead><tr><th scope="col">Date ({timezone})</th>{scoreSeries.map(s => <th scope="col" key={s.key}>{s.label}</th>)}</tr></thead>
      <tbody>{points.map(p => <tr key={p.date}><th scope="row">{p.date}</th>
        {scoreSeries.map(s => <td key={s.key}>{scoreText(s.key, p)}</td>)}</tr>)}</tbody></table>} />;
}
export function OutlookLegend() {
  return <p className="outlook-legend">
    <strong>Outlook</strong>{" "}
    <span className="tag">Likely to pass · 60% or higher</span>{" "}
    <span className="tag">Continue practicing · 40–60%</span>{" "}
    <span className="tag">May need support · below 40%</span>{" "}
    <span>Advisory only: grades and progress follow the configured rules.</span>
  </p>;
}

export function outlookOf(row?: StudentRow): string {
  if (!row?.forecast) return "unavailable";
  if (row.forecast.label === "May need support") return "support";
  if (row.forecast.label === "Continue practicing") return "practicing";
  return "likely";
}

export function forecastTone(label: string): "bad" | "wait" | "good" {
  if (label === "May need support") return "bad";
  if (label === "Continue practicing") return "wait";
  return "good";
}

/** Missing numbers sort last whichever direction the column runs. */
export function compareNumbers(a: number | null, b: number | null, descending: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return descending ? b - a : a - b;
}

function ForecastDetails({ forecast }: { forecast: NonNullable<StudentRow["forecast"]> }) {
  return (
    <dl className="ws-summary-list">
      <div>
        <dt>Target activity</dt>
        <dd>{forecast.target_activity}</dd>
      </div>
      <div>
        <dt>Estimated chance of passing this activity</dt>
        <dd>
          {Math.round(forecast.probability * 100)}% · {forecast.label}
        </dd>
      </div>
      <div>
        <dt>Predicted outcome</dt>
        <dd>{forecast.predicted_pass ? "Pass" : "Not pass"}</dd>
      </div>
      <div>
        <dt>Model</dt>
        <dd>
          {forecast.selected_model === "logreg" ? "Logistic regression" : "Random forest"} ·{" "}
          {forecast.model_version}
        </dd>
      </div>
      {forecast.probabilities && (
        <div>
          <dt>Both models</dt>
          <dd>
            Logistic regression {Math.round(forecast.probabilities.logreg * 100)}%
            {forecast.selected_model === "logreg" ? " (used)" : ""} · Random forest{" "}
            {Math.round(forecast.probabilities.random_forest * 100)}%
            {forecast.selected_model === "random_forest" ? " (used)" : ""}
          </dd>
        </div>
      )}
      <div>
        <dt>Forecast date</dt>
        <dd>{formatDateTime(forecast.as_of)}</dd>
      </div>
      <div>
        <dt>Observed outcome</dt>
        <dd>
          {forecast.actual_outcome === null
            ? "Pending"
            : forecast.actual_outcome
              ? "Passed"
              : "Not passed"}
        </dd>
      </div>
      <div>
        <dt>Use</dt>
        <dd>{forecast.advisory}</dd>
      </div>
    </dl>
  );
}

function SavedForecastItem({ forecast }: { forecast: SavedForecast }) {
  return (
    <li>
      <strong>
        {forecast.target_activity}:{" "}
        {isLegacy(forecast) ? forecast.label : `${Math.round(forecast.probability * 100)}%`}
      </strong>
      <span>
        {formatDateTime(forecast.as_of)} · {forecast.model_version}
        {forecast.is_current ? " · current forecast" : " · earlier forecast"}
        {!forecast.is_current && !forecast.from_active_model ? " (not the active model)" : ""} ·{" "}
        {forecast.actual_outcome === null
          ? "Outcome pending"
          : forecast.actual_outcome
            ? "Passed"
            : "Not passed"}
      </span>
    </li>
  );
}


export function LearnerForecast({ detail }: { detail: Detail }) {
  const {student, evidence, predictions} = detail;
  const forecast = student.forecast;
  return <section><h3>Forecast</h3>
    {forecast ? <><ForecastDetails forecast={forecast}/><p>{TEACHING_ACTIONS[forecast.label]}</p></> :
      <p>{FORECAST_REASONS[student.forecast_status] || "Unavailable"}</p>}
    {student.target_activity && <p>Next challenge · {student.target_activity}</p>}
    <p>{evidence.prior_tasks_attempted} of {evidence.prior_tasks_required} earlier course activities attempted.</p>
    <p className="ws-muted">These historical results are not explanations of the model output.</p>
    <h4>Saved forecast history</h4>{predictions.length ? <ul className="ws-compact-list">{predictions.map(p => <SavedForecastItem key={p.id} forecast={p}/>)}</ul> : <p>No eligible saved forecasts.</p>}
  </section>;
}
