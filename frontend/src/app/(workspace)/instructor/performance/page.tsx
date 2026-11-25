"use client";

import Link from "next/link";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, getErrorMessage } from "@/lib/api";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button,
  ConfirmDialog,
  Identity,
  LoadingPanel,
  Notice,
  personName,
  SearchField,
  SelectField,
  StatusChip,
  Toolbar,
  useApi,
} from "@/components/workspace/ui";
import { Gradebook } from "@/components/instructor/gradebook";
import {
  formatDateTime,
  getStudentPerformance,
  type PerformanceResponse,
  type StudentPerformance,
} from "@/lib/workspace";

import { metrics } from "@/lib/insight-metrics";
import { PageHeader, Section, StatStrip, RowSkeleton, InlineError, InlineEmpty } from "@/components/instructor/course-ui";
import { MeasureDefinitions, UpdatedAt } from "@/components/insights/ui";
import { type Dashboard, type Detail, PERIODS, READINESS_MESSAGES, isPeriod } from "../ml/types";
import { LearnerForecast, Trend, compareNumbers, outlookOf, forecastTone } from "./forecasts";

/** One advisory note wherever forecasts appear, so instructors read them the same way. */
const OUTLOOK_NOTE = "Outlook estimates each consented learner's chance that their first submission on their next coding challenge passes. It is advisory, for instructors only: students never see it, and it changes no grade or access.";

function FacultyPerformance() {
  const { courseId } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activity") || "";
  const stuckOnly = Boolean(activityId) && searchParams.get("stuck") === "1";
  const notStarted = searchParams.get("notStarted") === "1";
  const inactive = searchParams.get("inactive") === "1";
  const rawPeriod = searchParams.get("period");
  const period = isPeriod(rawPeriod) ? rawPeriod : "all";
  const ml = useApi<Dashboard>(courseId ? "/faculty/ml?" + new URLSearchParams({ course_id: courseId, period }) : null, true);
  const forecastData = ml.data?.period === period ? ml.data : null;
  const available = forecastData?.readiness.forecasts_available;
  const [outlook, setOutlook] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [learnerInsight, setLearnerInsight] = useState<Detail | null>(null);
  const [forecastError, setForecastError] = useState("");
  const request = useRef(0);
  const appliedSearch = searchParams.get("q") || "";
  const [search, setSearch] = useState(appliedSearch);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StudentPerformance | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(appliedSearch);
  }, [appliedSearch]);

  const path = useMemo(
    () =>
      courseId
        ? `/faculty/performance?${new URLSearchParams({
            course_id: courseId,
            ...(activityId ? { activity_id: activityId } : {}),
            ...(notStarted ? { not_started: "true" } : {}),
            ...(inactive ? { inactive: "1" } : {}),
            ...(stuckOnly ? { stuck_only: "true" } : {}),
            ...(appliedSearch ? { search: appliedSearch } : {}),
          }).toString()}`
        : null,
    [activityId, appliedSearch, courseId, stuckOnly, inactive, notStarted],
  );
  const { data, error, loading, reload } = useApi<PerformanceResponse>(path, true);

  function updateQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    setPage(1);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function openStudent(id: string) {
    const current = ++request.current;
    setStudentId(id);
    setForecastError("");
    setLearnerInsight(null);
    void apiRequest<Detail>("/faculty/ml/students/" + id + "?" + new URLSearchParams({ course_id: courseId || "", period }))
      .then(value => { if (current === request.current) setLearnerInsight(value); })
      .catch(e => { if (current === request.current) setForecastError(getErrorMessage(e)); });
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const result = await getStudentPerformance(id, courseId);
      if (current === request.current) setDetail(result);
    } catch (caught) {
      if (current === request.current) setDetailError(getErrorMessage(caught));
    } finally {
      if (current === request.current) setDetailLoading(false);
    }
  }

  const forecasts = new Map(forecastData?.students.map(student => [student.student_id, student]));
  const all = data?.students ?? [];
  const rows = all.filter(row => !available || !outlook || outlookOf(forecasts.get(row.student_id)) === outlook).sort((a,b) => {
    if (sort === "latest") return compareNumbers(a.latest_score, b.latest_score, true);
    if (available && sort === "probability") return compareNumbers(forecasts.get(a.student_id)?.forecast?.probability ?? null, forecasts.get(b.student_id)?.forecast?.probability ?? null, false);
    return (a.display_name || a.username).localeCompare(b.display_name || b.username);
  });
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 25)));
  const hasFilters = Boolean(activityId || appliedSearch || notStarted || inactive || (available && outlook));
  function clear() {
    setSearch(""); setOutlook(""); setPage(1);
    updateQuery({ activity: null, q: null, stuck: null, notStarted: null, inactive: null });
  }
  return (
    <>
      <PageHeader title="Student Progress" subtitle="Course results, practice attempts and learner outlook."
        actions={<Button variant="outline" onClick={() => { reload(); ml.reload(); }}>Refresh</Button>}/>
      <Section title="Class score trend">
        <SelectField label="Historical period" value={period} onChange={value => { request.current++; setStudentId(null); updateQuery({ period: value }); }}
          options={PERIODS.map(p => ({ ...p }))}/>
        <p className="ws-muted">The period changes reported history only. It never changes model inputs, the next activity, or whether a forecast is available.</p>
        {ml.error && <InlineError onRetry={ml.reload}/>}
        {forecastData ? <Trend points={forecastData.trend} events={forecastData.summary.graded_events} timezone={forecastData.aggregation_timezone} label="Class score trend"/> : ml.loading && <RowSkeleton/>}
        {forecastData && !available && <p className="ws-muted">{READINESS_MESSAGES[forecastData.readiness.status] || READINESS_MESSAGES.unavailable} Once it&apos;s on, an Outlook column appears. {OUTLOOK_NOTE} <Link href={"/instructor/ml?course=" + courseId}>Model evaluation</Link></p>}
      </Section>
      <Toolbar label="Performance filters">
        <SearchField value={search} onChange={setSearch} onSubmit={() => updateQuery({ q: search || null })} placeholder="Search learners" label="Search learners" />
        <SelectField
          label="Activity"
          value={activityId}
          onChange={(value) => updateQuery({ activity: value || null, stuck: null })}
          options={(data?.activities || []).map((activity) => ({ value: activity.activity_id, label: activity.title }))}
          includeAll
          allLabel="All published activities"
        />
        <SelectField label="Participation" value={inactive ? "inactive" : notStarted ? "notStarted" : ""} includeAll allLabel="All learners"
          onChange={value => updateQuery({ inactive: value === "inactive" ? "1" : null, notStarted: value === "notStarted" ? "1" : null })}
          options={[{ value: "inactive", label: metrics.inactive_7d.label }, { value: "notStarted", label: metrics.not_started.label }]}/>
        {available && <SelectField label="Outlook" value={outlook} onChange={v => {setPage(1); setOutlook(v);}} includeAll allLabel="All outlooks"
          options={[["support","May need support"],["practicing","Continue practicing"],["likely","Likely to pass"],["unavailable","Unavailable"]].map(([value,label]) => ({
            value, label: label + " (" + all.filter(r => outlookOf(forecasts.get(r.student_id)) === value).length + ")"
          }))}/>}
        <SelectField label="Sort by" value={sort} onChange={v => {setSort(v); setPage(1);}} options={[
          {value:"name", label:"Learner name (A–Z)"}, {value:"latest", label:"Latest score (high to low)"},
          ...(available ? [{value:"probability",label:"Forecast probability (low to high)"}] : [])]}/>
        {stuckOnly ? <Button variant="outline" onClick={() => updateQuery({ stuck: null })}>Show all learners</Button> : null}
        {hasFilters ? (
          <Button variant="quiet" onClick={clear}>
            Clear filters
          </Button>
        ) : null}
      </Toolbar>
      {stuckOnly ? <p className="ws-muted">Showing learners with repeated practice attempts and no pass on this activity.</p> : null}

      {error && <InlineError onRetry={reload}/>}
      {loading && !data && <RowSkeleton />}
      {data && <><StatStrip label="Class progress statistics" items={[
        { label: "Enrolled", value: data.summary.active_learners },
        { label: activityId ? "Selected activity average" : metrics.latest_activity_average.label,
          value: data.summary.average_score == null ? "—" : data.summary.average_score + "%", note: data.summary.latest_activity_title ?? "No graded attempts yet" },
        { label: metrics.activities_passed.label, value: data.summary.average_completion_percent == null ? "—" : data.summary.average_completion_percent + "%", note: "avg of " + data.summary.published_activities + " published activities" },
        { label: metrics.not_started.label, value: data.summary.need_follow_up },
      ]}/><MeasureDefinitions names={["activities_passed","latest_activity_average","not_started","inactive_7d"]}>
        {available ? <li><strong>Outlook</strong> · {OUTLOOK_NOTE}</li> : null}
      </MeasureDefinitions>
      {data.summary.as_of && <UpdatedAt at={data.summary.as_of}/>}</>}
      {!loading && data && !rows.length && <InlineEmpty>{hasFilters ? "No learners match these filters" : "No students enrolled yet"} {hasFilters && <Button onClick={clear}>Clear filters</Button>}</InlineEmpty>}
      <div id="instructor-roster">
      {rows.length > 0 ? (
        <div className="ws-table-wrap">
          <table className="ws-table analysis-table roster-table">
            <caption className="sr-only">Student performance for this course</caption>
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">{metrics.activities_passed.label}</th>
                <th scope="col">Latest score</th>
                {available && <th scope="col">Outlook</th>}
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((currentPage-1)*25, currentPage*25).map(row => {
                const forecast = forecasts.get(row.student_id)?.forecast;
                return (
                <tr key={row.student_id}>
                  <td data-label="Learner">
                    <Identity
                      displayName={row.display_name}
                      pseudonym={row.pseudonym}
                      username={row.username}
                      meta={row.enrolled_language?.toUpperCase() ?? "Language not chosen"}
                    />
                  </td>
                  <td data-label={metrics.activities_passed.label}>
                    {row.completed_count} / {row.total_activities}
                    <span className="ws-row-meta">{row.attempt_count} attempt{row.attempt_count === 1 ? "" : "s"}</span>
                  </td>
                  <td data-label="Latest score">
                    {row.latest_score === null ? "—" : `${row.latest_score}%`}
                    <span className="ws-row-meta">{row.latest_at ? formatDateTime(row.latest_at) : "No attempts"}</span>
                  </td>
                  {available && <td data-label="Outlook">{forecast ? <><StatusChip state="ready" label={forecast.label} tone={forecastTone(forecast.label)}/><span className="ws-row-meta">{Math.round(forecast.probability*100)}% estimated chance of passing</span></> : "Unavailable"}</td>}
                  <td data-label="Action">
                    <Button variant="outline" data-tooltip="View this learner's attempt history" onClick={() => void openStudent(row.student_id)}>
                      View history
                    </Button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      ) : null}

      </div>
      {rows.length > 25 && <div className="ws-pager"><Button disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>Previous</Button> Page {currentPage} of {Math.ceil(rows.length/25)} <Button disabled={currentPage*25 >= rows.length} onClick={() => setPage(currentPage+1)}>Next</Button></div>}
      {!hasFilters ? <Gradebook courseId={courseId} onOpenStudent={(id) => void openStudent(id)} /> : null}

      <ConfirmDialog
        open={Boolean(studentId)} variant="drawer"
        title={detail ? `${personName(detail.student.display_name, detail.student.pseudonym, detail.student.username)} · history` : "Learner history"}
        confirmLabel="Close"
        hideConfirm
        onCancel={() => { request.current++; setStudentId(null); }}
      >
        {detailLoading ? <LoadingPanel label="Loading learner history…" /> : null}
        {detailError ? <Notice tone="error">{detailError}</Notice> : null}
        {detail ? (
          <div className="ws-student-detail">
            <dl className="ws-summary-list">
              <div><dt>Course</dt><dd>{detail.course.title}</dd></div>
              <div><dt>{metrics.activities_passed.label}</dt><dd>{detail.progress.completed} of {detail.progress.total} published activities ({detail.progress.percent}%)</dd></div>
              <div><dt>Level / XP</dt><dd>Level {detail.student.current_level} · {detail.student.xp_points} XP</dd></div>
            </dl>
            {learnerInsight && <Trend points={learnerInsight.trend} events={learnerInsight.history.length} timezone={forecastData?.aggregation_timezone || "UTC"} label="Personal score trend"/>}
            <h3>Attempts ({detail.attempts.length})</h3>
            {detail.attempts.length === 0 ? (
              <p className="ws-muted">No attempts in this course yet.</p>
            ) : (
              <ul className="ws-compact-list">
                {detail.attempts.map((attempt) => (
                  <li key={attempt.attempt_id}>
                    <strong>{attempt.title}</strong>
                    <span>
                      {attempt.activity_type === "quiz" ? "Quiz" : "Challenge"} · {attempt.score_percentage}% ·{" "}
                      {attempt.is_successful ? "Passed" : "Not passed"} · {formatDateTime(attempt.created_at)}
                    </span>
                    {attempt.submitted_code ? (
                      <details>
                        <summary className="ws-inline-link">View submitted code (attempt {attempt.attempt_number})</summary>
                        <pre className="ws-code"><code>{attempt.submitted_code}</code></pre>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        {forecastError && <Notice tone="error">{forecastError}</Notice>}
        {learnerInsight && <LearnerForecast detail={learnerInsight} />}
      </ConfirmDialog>
    </>
  );
}

function CoursePerformance() {
  const { courseId } = useWorkspace();
  return <FacultyPerformance key={courseId} />;
}

export default function Page() {
  return (
    <WorkspaceSuspense label="performance">
      <CoursePerformance />
    </WorkspaceSuspense>
  );
}
