"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Identity,
  LoadingPanel,
  Notice,
  SearchField,
  SelectField,
  StatCard,
  StatusChip,
  Toolbar,
  useApi,
} from "@/components/workspace/ui";
import { formatDateTime } from "@/lib/workspace";
import {
  Dashboard,
  Detail,
  FORECAST_REASONS,
  Period,
  READINESS_MESSAGES,
  SavedForecast,
  StudentRow,
  TEACHING_ACTIONS,
  TrendPoint,
  isLegacy,
} from "./types";

const PAGE_SIZE = 25;

// Each series is told apart by its dash pattern as well as its colour, so the
// chart stays readable without colour vision.
const SERIES = [
  { key: "quiz", label: "Quiz", color: "#2563eb", dash: "" },
  { key: "challenge", label: "Coding challenge", color: "#16a34a", dash: "7 4" },
  { key: "exam", label: "Released exam", color: "#ea580c", dash: "2 4" },
] as const;

export function Trend({
  points,
  events,
  timezone,
  label,
}: {
  points: TrendPoint[];
  events: number;
  timezone: string;
  label: string;
}) {
  if (!points.length) return <p className="ws-muted">No graded results in this period.</p>;

  const width = 640;
  const height = 200;
  const left = 46;
  const right = 16;
  const top = 12;
  const bottom = 34;
  const times = points.map((point) => Date.parse(`${point.date}T00:00:00Z`));
  const first = Math.min(...times);
  const last = Math.max(...times);
  const span = last - first;
  // Points sit at their real date, so an irregular gap between results reads
  // as a gap rather than as evenly spaced activity.
  const x = (time: number) =>
    span === 0 ? (left + width - right) / 2 : left + ((time - first) / span) * (width - left - right);
  const y = (score: number) => top + (1 - score / 100) * (height - top - bottom);
  const axisDates = span === 0 ? [points[0].date] : [points[0].date, points[points.length - 1].date];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        style={{ width: "100%", height: "auto" }}
      >
        {[0, 25, 50, 75, 100].map((score) => (
          <g key={score}>
            <line x1={left} x2={width - right} y1={y(score)} y2={y(score)} stroke="#e2e8f0" />
            <text x={left - 8} y={y(score) + 4} fontSize="11" fill="#64748b" textAnchor="end">
              {score}%
            </text>
          </g>
        ))}
        {axisDates.map((date, index) => (
          <text
            key={date}
            x={x(Date.parse(`${date}T00:00:00Z`))}
            y={height - 12}
            fontSize="11"
            fill="#64748b"
            textAnchor={axisDates.length === 1 || index === 0 ? "start" : "end"}
          >
            {date}
          </text>
        ))}
        {SERIES.map((series) => {
          const observed = points
            .map((point) => ({ point, value: point[series.key] }))
            .filter((item) => item.value !== null);
          if (!observed.length) return null;
          const coordinates = observed.map(
            (item) => `${x(Date.parse(`${item.point.date}T00:00:00Z`))},${y(item.value as number)}`,
          );
          return (
            <g key={series.key}>
              <polyline
                points={coordinates.join(" ")}
                fill="none"
                stroke={series.color}
                strokeWidth="2.5"
                strokeDasharray={series.dash}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {coordinates.map((coordinate) => {
                const [cx, cy] = coordinate.split(",");
                return <circle key={`${series.key}-${coordinate}`} cx={cx} cy={cy} r="3.5" fill={series.color} />;
              })}
            </g>
          );
        })}
      </svg>
      <p className="ws-row-meta">
        {events} graded {events === 1 ? "result" : "results"} · daily averages in {timezone} ·{" "}
        {SERIES.map((series) => (
          <span key={series.key} style={{ color: series.color }}>
            ● {series.label}{" "}
          </span>
        ))}
      </p>
      <details>
        <summary>View trend data</summary>
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr>
                <th scope="col">Date ({timezone})</th>
                <th scope="col">Quiz</th>
                <th scope="col">Coding challenge</th>
                <th scope="col">Released exam</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.date}>
                  <td data-label="Date">{point.date}</td>
                  <td data-label="Quiz">{point.quiz === null ? "—" : `${point.quiz}%`}</td>
                  <td data-label="Coding challenge">
                    {point.challenge === null ? "—" : `${point.challenge}%`}
                  </td>
                  <td data-label="Released exam">{point.exam === null ? "—" : `${point.exam}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function outlookOf(row: StudentRow): string {
  if (!row.forecast) return "unavailable";
  if (row.forecast.label === "May need support") return "support";
  if (row.forecast.label === "Continue practicing") return "practicing";
  return "likely";
}

function forecastTone(label: string): "bad" | "wait" | "good" {
  if (label === "May need support") return "bad";
  if (label === "Continue practicing") return "wait";
  return "good";
}

/** Missing numbers sort last whichever direction the column runs. */
function compareNumbers(a: number | null, b: number | null, descending: boolean): number {
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

function LearnerDrawer({
  open,
  detail,
  loading,
  error,
  courseId,
  timezone,
  onClose,
}: {
  open: boolean;
  detail: Detail | null;
  loading: boolean;
  error: string;
  courseId: string | null;
  timezone: string;
  onClose: () => void;
}) {
  const student = detail?.student;
  const forecast = student?.forecast || null;
  const courseQuery = courseId ? `?course_id=${encodeURIComponent(courseId)}` : "";
  const guidance = forecast
    ? TEACHING_ACTIONS[forecast.label]
    : `${FORECAST_REASONS[student?.forecast_status || ""] || "A forecast is unavailable"}. Review the historical results below instead.`;

  return (
    <ConfirmDialog
      open={open}
      variant="drawer"
      title={
        student ? `${student.display_name || `@${student.username}`} · learner detail` : "Learner detail"
      }
      confirmLabel="Close"
      cancelLabel="Close"
      hideConfirm
      onCancel={onClose}
    >
      {loading ? <LoadingPanel label="Loading learner detail…" /> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {detail && student ? (
        <div className="ws-student-detail">
          <p className="ws-row-meta">
            @{student.username} · {detail.course?.title || "This course"}
          </p>

          <h3>Next activity</h3>
          <p>{student.target_activity || "No eligible next activity."}</p>

          <h3>Current forecast</h3>
          {forecast ? (
            <ForecastDetails forecast={forecast} />
          ) : (
            <p>{FORECAST_REASONS[student.forecast_status] || "Unavailable"}</p>
          )}

          <h3>Historical evidence</h3>
          <p className="ws-muted">
            Observed results only. These are not explanations of the model output.
          </p>
          <ul className="ws-compact-list">
            <li>
              <strong>{detail.evidence.result_count} recorded results in this period</strong>
              <span>
                {student.quiz_count} quizzes · {student.challenge_count} coding ·{" "}
                {student.exam_count} released exams
              </span>
            </li>
            <li>
              <strong>
                {detail.evidence.topic_activities_attempted} of{" "}
                {detail.evidence.topic_activities_required} activities attempted in{" "}
                {detail.evidence.topic || "the next topic"}
              </strong>
              <span>Topic history required before a forecast is eligible</span>
            </li>
          </ul>

          <h3>Suggested teaching action</h3>
          <p>{guidance}</p>
          <p className="ws-row-meta">
            <Link className="ws-text-link" href={`/faculty/performance${courseQuery}`}>
              Open Performance →
            </Link>{" "}
            <Link className="ws-text-link" href={`/faculty/activities${courseQuery}`}>
              Open Activities →
            </Link>
          </p>

          <h3>Personal score trend</h3>
          <Trend
            points={detail.trend || []}
            events={detail.history.length}
            timezone={timezone}
            label={`Daily average scores for ${student.display_name || student.username}`}
          />

          <h3>Historical results</h3>
          {detail.history.length ? (
            <ul className="ws-compact-list">
              {detail.history.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <strong>{event.title}</strong>
                  <span>
                    {event.kind === "exam"
                      ? "Released exam"
                      : event.kind === "quiz"
                        ? "Quiz"
                        : "Coding challenge"}{" "}
                    · {event.score_percentage}% · {formatDateTime(event.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No graded results in this period.</p>
          )}

          <h3>Saved forecast history</h3>
          {detail.predictions.length ? (
            <ul className="ws-compact-list">
              {detail.predictions.map((prediction) => (
                <SavedForecastItem key={prediction.id} forecast={prediction} />
              ))}
            </ul>
          ) : (
            <p>No eligible saved forecasts.</p>
          )}
        </div>
      ) : null}
    </ConfirmDialog>
  );
}

export default function LearnerInsights({
  courseId,
  period,
  refreshToken,
  onLoaded,
}: {
  courseId: string | null;
  period: Period;
  refreshToken: number;
  onLoaded: (at: Date) => void;
}) {
  const path = useMemo(
    () =>
      courseId
        ? `/faculty/ml?course_id=${encodeURIComponent(courseId)}&period=${encodeURIComponent(period)}`
        : null,
    [courseId, period],
  );
  const { data, error, loading, reload } = useApi<Dashboard>(path);
  const [search, setSearch] = useState("");
  const [outlook, setOutlook] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRequest = useRef(0);
  const firstRefresh = useRef(refreshToken);
  const [shownPeriod, setShownPeriod] = useState(period);

  // A detail response is period-scoped, so an open drawer would otherwise show
  // one period beside another. Adjusted during render rather than in an effect.
  if (shownPeriod !== period) {
    setShownPeriod(period);
    setSelected(null);
    setDetail(null);
    setPage(1);
  }

  useEffect(() => {
    if (refreshToken !== firstRefresh.current) reload();
  }, [refreshToken, reload]);

  useEffect(() => {
    if (data) onLoaded(new Date());
  }, [data, onLoaded]);

  const rows = useMemo(() => {
    const all = data?.students || [];
    const term = search.trim().toLowerCase();
    const filtered = all.filter((row) => {
      const matchesTerm =
        !term ||
        (row.display_name || "").toLowerCase().includes(term) ||
        row.username.toLowerCase().includes(term);
      return matchesTerm && (!outlook || outlookOf(row) === outlook);
    });
    const sorted = [...filtered];
    if (sort === "latest") {
      sorted.sort((a, b) => compareNumbers(a.latest_score, b.latest_score, true));
    } else if (sort === "probability") {
      sorted.sort((a, b) =>
        compareNumbers(a.forecast?.probability ?? null, b.forecast?.probability ?? null, false),
      );
    } else {
      sorted.sort((a, b) =>
        (a.display_name || a.username).localeCompare(b.display_name || b.username),
      );
    }
    return sorted;
  }, [data, outlook, search, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function openStudent(studentId: string) {
    const requestId = ++detailRequest.current;
    setSelected(studentId);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const response = await apiRequest<Detail>(
        `/faculty/ml/students/${studentId}?course_id=${encodeURIComponent(courseId || "")}&period=${encodeURIComponent(period)}`,
      );
      if (requestId === detailRequest.current) setDetail(response);
    } catch (caught) {
      if (requestId === detailRequest.current) setDetailError(getErrorMessage(caught));
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  }

  const timezone = data?.aggregation_timezone || "UTC";
  const available = data?.readiness.forecasts_available;

  return (
    <>
      {error ? (
        <Notice tone="error">
          Learner insights could not load{data ? "; showing the last results for this course" : ""}.{" "}
          {error}
        </Notice>
      ) : null}
      {loading && !data ? <LoadingPanel label="Loading Machine Learning dashboard…" /> : null}
      {data ? (
        <>
          {!available ? (
            <Notice tone="info">
              Forecasts are unavailable:{" "}
              {READINESS_MESSAGES[data.readiness.status] || READINESS_MESSAGES.unavailable}
            </Notice>
          ) : null}

          <div className="ws-stat-grid" aria-label="Course-wide summary">
            <StatCard
              label="Enrolled learners"
              value={data.summary.active_learners}
              hint="Active enrolments, course-wide"
              icon="◉"
            />
            <StatCard
              label="Average recorded score"
              value={data.summary.average_score === null ? "—" : `${data.summary.average_score}%`}
              hint={`Activity history across ${data.summary.graded_events} graded results, not an official grade`}
              icon="↗"
            />
            <StatCard
              label="Available forecasts"
              value={`${data.summary.forecast_count} of ${data.summary.forecast_denominator}`}
              hint="Learners with a valid current forecast"
              icon="◇"
            />
            <StatCard
              label="May need support"
              value={data.summary.need_support === null ? "Unavailable" : data.summary.need_support}
              hint={
                data.summary.need_support === null
                  ? "No approved model is active"
                  : `Current forecast below ${Math.round(data.thresholds.support_below * 100)}%`
              }
              icon="◈"
            />
          </div>
          <p className="ws-muted">
            Summary cards describe the whole course. Repeated attempts count as separate recorded
            results.
          </p>

          <section className="ws-panel" aria-labelledby="ml-trend-title">
            <div className="ws-panel-head ml-panel-head">
              <div>
                <p className="eyebrow-label">HISTORICAL SCORES</p>
                <h2 id="ml-trend-title">Class score trend</h2>
              </div>
              <Link className="ws-text-link" href="/faculty/performance">
                Open detailed Performance →
              </Link>
            </div>
            <Trend
              points={data.trend}
              events={data.summary.graded_events}
              timezone={timezone}
              label="Daily average scores for quizzes, coding challenges and released exams"
            />
          </section>

          <section aria-labelledby="ml-students-title">
            <h2 id="ml-students-title">Learner outlook</h2>
            {data.students.length === 0 ? (
              <EmptyState title="No students enrolled yet">
                An administrator can enroll students in this course.
              </EmptyState>
            ) : (
              <>
                <Toolbar label="Learner filters">
                  <SearchField
                    value={search}
                    onChange={(value) => {
                      setSearch(value);
                      setPage(1);
                    }}
                    label="Search learners"
                    placeholder="Search name or username"
                  />
                  <SelectField
                    label="Outlook"
                    value={outlook}
                    onChange={(value) => {
                      setOutlook(value);
                      setPage(1);
                    }}
                    includeAll
                    allLabel="All"
                    options={[
                      { value: "support", label: "May need support" },
                      { value: "practicing", label: "Continue practicing" },
                      { value: "likely", label: "Likely to pass" },
                      { value: "unavailable", label: "Unavailable" },
                    ]}
                  />
                  <SelectField
                    label="Sort by"
                    value={sort}
                    onChange={(value) => {
                      setSort(value);
                      setPage(1);
                    }}
                    options={[
                      { value: "name", label: "Learner name (A–Z)" },
                      { value: "latest", label: "Latest score (high to low)" },
                      { value: "probability", label: "Forecast probability (low to high)" },
                    ]}
                  />
                </Toolbar>
                {rows.length === 0 ? (
                  <EmptyState title="No learners match these filters">
                    Clear the search or outlook filter to see the whole course.
                  </EmptyState>
                ) : (
                  <>
                    <div className="ws-table-wrap">
                      <table className="ws-table">
                        <caption className="sr-only">
                          Course learner results and next-activity forecasts
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Learner</th>
                            <th scope="col">Recorded average</th>
                            <th scope="col">Latest score</th>
                            <th scope="col">Results</th>
                            <th scope="col">Next eligible activity</th>
                            <th scope="col">Outlook</th>
                            <th scope="col">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((student) => (
                            <tr key={student.student_id}>
                              <td data-label="Learner">
                                <Identity
                                  displayName={student.display_name}
                                  username={student.username}
                                  pseudonym={student.student_id}
                                />
                              </td>
                              <td data-label="Recorded average">
                                {student.average_score === null ? "—" : `${student.average_score}%`}
                              </td>
                              <td data-label="Latest score">
                                {student.latest_score === null ? "—" : `${student.latest_score}%`}
                              </td>
                              <td data-label="Results">
                                {student.quiz_count} quizzes · {student.challenge_count} coding ·{" "}
                                {student.exam_count} exams
                              </td>
                              <td data-label="Next eligible activity">
                                {student.target_activity || "—"}
                              </td>
                              <td data-label="Outlook">
                                {student.forecast ? (
                                  <>
                                    <StatusChip
                                      state="ready"
                                      label={student.forecast.label}
                                      tone={forecastTone(student.forecast.label)}
                                    />
                                    <span className="ws-row-meta">
                                      {Math.round(student.forecast.probability * 100)}% estimated
                                      chance of passing · {student.forecast.model_version} ·{" "}
                                      {formatDateTime(student.forecast.as_of)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="ws-muted">
                                    {FORECAST_REASONS[student.forecast_status] || "Unavailable"}
                                  </span>
                                )}
                              </td>
                              <td data-label="Action">
                                <Button
                                  variant="outline"
                                  onClick={() => void openStudent(student.student_id)}
                                >
                                  View learner
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="ws-pager">
                      <p className="ws-row-meta" role="status">
                        Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                        {Math.min(currentPage * PAGE_SIZE, rows.length)} of {rows.length} matching
                        learners
                      </p>
                      {pageCount > 1 ? (
                        <div className="ws-inline-actions">
                          <Button
                            variant="outline"
                            disabled={currentPage <= 1}
                            onClick={() => setPage(currentPage - 1)}
                          >
                            Previous
                          </Button>
                          <span className="ws-row-meta">
                            Page {currentPage} of {pageCount}
                          </span>
                          <Button
                            variant="outline"
                            disabled={currentPage >= pageCount}
                            onClick={() => setPage(currentPage + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </>
      ) : null}

      <LearnerDrawer
        open={Boolean(selected)}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        courseId={courseId}
        timezone={timezone}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
