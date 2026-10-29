"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/api";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  LoadingPanel,
  Notice,
  PageHeading,
  SearchField,
  SelectField,
  StatCard,
  StatusChip,
  Toolbar,
  useApi,
} from "@/components/workspace/ui";
import {
  formatDateTime,
  getStudentPerformance,
  type PerformanceResponse,
  type StudentPerformance,
} from "@/lib/workspace";

function PredictionCell({ prediction }: { prediction: PerformanceResponse["students"][number]["prediction"] }) {
  if (prediction.status === "saved") {
    return (
      <div className="ws-prediction">
        <StatusChip state="ready" label="Saved prediction" tone="info" />
        <span className="ws-row-meta">as of {formatDateTime(prediction.as_of)}</span>
        <span className="ws-prediction-label">{prediction.label}</span>
        {prediction.probability !== undefined ? (
          <span className="ws-row-meta">{(prediction.probability * 100).toFixed(0)}% estimated pass chance</span>
        ) : null}
      </div>
    );
  }
  return (
    <div className="ws-prediction">
      <StatusChip state="unavailable" label="Unavailable" tone="muted" />
      <span className="ws-row-meta">{prediction.reason}</span>
    </div>
  );
}

function FacultyPerformance() {
  const { courseId } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activity") || "";
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
            ...(appliedSearch ? { search: appliedSearch } : {}),
          }).toString()}`
        : null,
    [activityId, appliedSearch, courseId],
  );
  const { data, error, loading, reload } = useApi<PerformanceResponse>(path);

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

  const rows = data?.students || [];
  const hasFilters = Boolean(activityId || appliedSearch);

  return (
    <>
      <PageHeading
        eyebrow="FACULTY WORKSPACE"
        title="Student performance"
        description="Course results, attempt history and saved next-task predictions. Predictions are advisory and never change grades or access."
        status={data ? <StatusChip state="active" label={`${data.summary.active_learners} learners`} /> : undefined}
        actions={
          <Button variant="outline" onClick={reload}>
            Refresh
          </Button>
        }
      />

      <Toolbar label="Performance filters">
        <SearchField value={search} onChange={setSearch} onSubmit={() => updateQuery({ q: search || null })} placeholder="Search learners" label="Search learners" />
        <SelectField
          label="Activity"
          value={activityId}
          onChange={(value) => updateQuery({ activity: value || null })}
          options={(data?.activities || []).map((activity) => ({ value: activity.activity_id, label: activity.title }))}
          includeAll
          allLabel="All published activities"
        />
        {hasFilters ? (
          <Button variant="quiet" onClick={() => { setSearch(""); updateQuery({ activity: null, q: null }); }}>
            Clear filters
          </Button>
        ) : null}
      </Toolbar>

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
            label="Average completion"
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
          title={hasFilters ? "No learners match these filters" : "No students enrolled yet"}
          action={
            hasFilters ? (
              <Button variant="outline" onClick={() => updateQuery({ activity: null, q: null })}>Clear filters</Button>
            ) : undefined
          }
        >
          {hasFilters
            ? "Try another activity or search term. Your filters stay until you clear them."
            : data.empty_reason || "An administrator enrolls students in this course."}
        </EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="sr-only">Student performance for this course</caption>
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">Completed</th>
                <th scope="col">Latest score</th>
                <th scope="col">Next-task prediction</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student_id}>
                  <td data-label="Learner">
                    <strong>{row.display_name || row.pseudonym}</strong>
                    <span className="ws-row-meta">{row.pseudonym} · {row.enrolled_language.toUpperCase()}</span>
                  </td>
                  <td data-label="Completed">
                    {row.completed_count} / {row.total_activities}
                    <span className="ws-row-meta">{row.attempt_count} attempt{row.attempt_count === 1 ? "" : "s"}</span>
                  </td>
                  <td data-label="Latest score">
                    {row.latest_score === null ? "—" : `${row.latest_score}%`}
                    <span className="ws-row-meta">{row.latest_at ? formatDateTime(row.latest_at) : "No attempts"}</span>
                  </td>
                  <td data-label="Prediction"><PredictionCell prediction={row.prediction} /></td>
                  <td data-label="Action">
                    <Button variant="outline" onClick={() => void openStudent(row.student_id)}>
                      View history
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="ws-footnote">
        {activityId
          ? "Completion counts the selected activity only. Predictions shown come from saved records and are never recomputed from later performance."
          : "Progress uses published activities in this course. Predictions are saved at assignment time and never change grades, rewards or access."}
      </p>

      <ConfirmDialog
        open={Boolean(studentId)}
        title={detail ? `${detail.student.display_name || detail.student.pseudonym} · history` : "Learner history"}
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
            <h3>Next-task prediction</h3>
            {detail.prediction.status === "saved" ? (
              <div className="ws-soft">
                <strong>{detail.prediction.label}</strong>
                <p>
                  As of {formatDateTime(detail.prediction.as_of)} · target {detail.prediction.target_activity || "next task"} · model{" "}
                  {detail.prediction.model_version}
                </p>
                <p>{detail.prediction.advisory}</p>
              </div>
            ) : (
              <p className="ws-muted">{detail.prediction.reason}</p>
            )}
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

export default function Page() {
  return (
    <WorkspaceSuspense label="performance">
      <FacultyPerformance />
    </WorkspaceSuspense>
  );
}
