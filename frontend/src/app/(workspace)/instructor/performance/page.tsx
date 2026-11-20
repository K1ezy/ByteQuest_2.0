"use client";

import Link from "next/link";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/api";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Identity,
  LoadingPanel,
  Notice,
  PageHeading,
  personName,
  SearchField,
  SelectField,
  StatCard,
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

function FacultyPerformance() {
  const { courseId } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activity") || "";
  const stuckOnly = Boolean(activityId) && searchParams.get("stuck") === "1";
  const notStarted = searchParams.get("notStarted") === "1";
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
            ...(stuckOnly ? { stuck_only: "true" } : {}),
            ...(appliedSearch ? { search: appliedSearch } : {}),
          }).toString()}`
        : null,
    [activityId, appliedSearch, courseId, stuckOnly],
  );
  const { data, error, loading, reload } = useApi<PerformanceResponse>(path, true);

  function updateQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function openStudent(id: string) {
    setStudentId(id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const result = await getStudentPerformance(id, courseId);
      setDetail(result);
    } catch (caught) {
      setDetailError(getErrorMessage(caught));
    } finally {
      setDetailLoading(false);
    }
  }

  const rows = (data?.students ?? []).filter((row) => !notStarted || row.attempt_count === 0);
  const hasFilters = Boolean(activityId || appliedSearch || notStarted);

  return (
    <>
      <PageHeading
        eyebrow="INSTRUCTOR WORKSPACE"
        title="Student Progress & Submissions"
        description="Course results and attempt history. Open Machine Learning for advisory next-activity forecasts."
        status={data ? <StatusChip state="active" label={`${data.summary.active_learners} learners`} /> : undefined}
        actions={
          <Button variant="outline" data-tooltip="Reload the latest learner results" onClick={reload}>
            Refresh
          </Button>
        }
      />

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
        {stuckOnly ? <Button variant="outline" onClick={() => updateQuery({ stuck: null })}>Show all learners</Button> : null}
        {hasFilters ? (
          <Button variant="quiet" onClick={() => { setSearch(""); updateQuery({ activity: null, q: null, stuck: null, notStarted: null }); }}>
            Clear filters
          </Button>
        ) : null}
      </Toolbar>
      {stuckOnly ? <p className="ws-muted">Showing learners with repeated practice attempts and no pass on this activity.</p> : null}

      {error ? (
        <Notice tone="error">
          Performance could not load. {error}{" "}
          <button type="button" className="ws-inline-link" onClick={reload}>Retry</button>
        </Notice>
      ) : null}
      {loading && !data ? <LoadingPanel label="Loading course performance…" /> : null}

      {data ? (
        <div className="ws-stat-grid" aria-label="Course summary">
          <StatCard label="Active learners" value={data.summary.active_learners} hint="Enrolled in this course" icon="◉" />
          <StatCard
            label={activityId ? "Average score (this activity)" : "Average latest score"}
            value={data.summary.average_score === null ? "—" : `${data.summary.average_score}%`}
            hint={data.summary.average_score === null ? "No graded attempts yet" : "Across learners with attempts"}
            icon="↗"
            tone="good"
          />
          <StatCard
            label="Average mastery"
            value={data.summary.average_completion_percent === null ? "—" : `${data.summary.average_completion_percent}%`}
            hint={`${data.summary.published_activities} published ${data.summary.published_activities === 1 ? "activity" : "activities"}`}
            icon="▦"
          />
          <StatCard
            label="Need follow-up"
            value={data.summary.need_follow_up}
            hint="No attempts recorded"
            icon="◇"
            tone={data.summary.need_follow_up ? "wait" : "good"}
          />
        </div>
      ) : null}

      {!loading && data && rows.length === 0 ? (
        <EmptyState
          title={stuckOnly && !appliedSearch ? "No stuck learners" : notStarted ? "Everyone has started" : hasFilters ? "No learners match these filters" : "No students enrolled yet"}
          action={
            hasFilters ? (
              <Button variant="outline" onClick={() => updateQuery({ activity: null, q: null, stuck: null, notStarted: null })}>Clear filters</Button>
            ) : undefined
          }
        >
          {hasFilters
            ? "Try another activity or search term. Your filters stay until you clear them."
            : data.empty_reason || "An administrator enrolls students in this course."}
        </EmptyState>
      ) : null}

      <div id="instructor-roster">
      {rows.length > 0 ? (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="sr-only">Student performance for this course</caption>
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">Mastered</th>
                <th scope="col">Latest score</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student_id}>
                  <td data-label="Learner">
                    <Identity
                      displayName={row.display_name}
                      pseudonym={row.pseudonym}
                      username={row.username}
                      meta={row.enrolled_language.toUpperCase()}
                    />
                  </td>
                  <td data-label="Mastered">
                    {row.completed_count} / {row.total_activities}
                    <span className="ws-row-meta">{row.attempt_count} attempt{row.attempt_count === 1 ? "" : "s"}</span>
                  </td>
                  <td data-label="Latest score">
                    {row.latest_score === null ? "—" : `${row.latest_score}%`}
                    <span className="ws-row-meta">{row.latest_at ? formatDateTime(row.latest_at) : "No attempts"}</span>
                  </td>
                  <td data-label="Action">
                    <Button variant="outline" data-tooltip="View this learner's attempt history" onClick={() => void openStudent(row.student_id)}>
                      View history
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      </div>
      {!hasFilters ? <Gradebook courseId={courseId} onOpenStudent={(id) => void openStudent(id)} /> : null}

      <p className="ws-footnote">
        {activityId
          ? "Completion counts the selected activity only."
          : "Progress uses published activities in this course."}{" "}
        <Link href={`/instructor/ml${courseId ? `?course=${courseId}` : ""}`}>Open Machine Learning for forecasts.</Link>
      </p>

      <ConfirmDialog
        open={Boolean(studentId)}
        title={detail ? `${personName(detail.student.display_name, detail.student.pseudonym, detail.student.username)} · history` : "Learner history"}
        confirmLabel="Close"
        hideConfirm
        onCancel={() => setStudentId(null)}
      >
        {detailLoading ? <LoadingPanel label="Loading learner history…" /> : null}
        {detailError ? <Notice tone="error">{detailError}</Notice> : null}
        {detail ? (
          <div className="ws-student-detail">
            <dl className="ws-summary-list">
              <div><dt>Course</dt><dd>{detail.course.title}</dd></div>
              <div><dt>Progress</dt><dd>{detail.progress.completed} of {detail.progress.total} published activities ({detail.progress.percent}%)</dd></div>
              <div><dt>Level / XP</dt><dd>Level {detail.student.current_level} · {detail.student.xp_points} XP</dd></div>
            </dl>
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
