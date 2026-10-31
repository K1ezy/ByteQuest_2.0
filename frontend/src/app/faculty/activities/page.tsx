"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getErrorMessage } from "@/lib/api";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button,
  EmptyState,
  FieldError,
  LoadingPanel,
  Notice,
  PageHeading,
  SearchField,
  SelectField,
  StatusChip,
  Toolbar,
  useApi,
} from "@/components/workspace/ui";
import {
  activityStateLabel,
  createActivity,
  formatDateTime,
  type ActivityList,
} from "@/lib/workspace";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

function FacultyActivities() {
  const { courseId, courseHref, refreshCourses } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "all";
  const type = searchParams.get("type") || "";
  const appliedSearch = searchParams.get("q") || "";
  const createRequested = searchParams.get("create") === "1";
  const [search, setSearch] = useState(appliedSearch);
  const [createOpen, setCreateOpen] = useState(createRequested);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({
    activity_type: "quiz",
    title: "",
    topic_concept: "",
    problem_statement: "",
    difficulty_level: 2,
    xp_reward: 30,
    reference_solution_code: "",
    starter_code: "",
    opens_at: "",
    closes_at: "",
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(appliedSearch);
    if (createRequested) setCreateOpen(true);
  }, [appliedSearch, createRequested]);

  const path = useMemo(
    () =>
      courseId
        ? `/faculty/activities?${new URLSearchParams({
            course_id: courseId,
            status,
            ...(type ? { type } : {}),
            ...(appliedSearch ? { search: appliedSearch } : {}),
          }).toString()}`
        : null,
    [appliedSearch, courseId, status, type],
  );
  const { data, error, loading, reload } = useApi<ActivityList>(path);

  function updateQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${window.location.pathname}?${next.toString()}`, { scroll: false });
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseId) return;
    const found: Record<string, string> = {};
    if (draft.title.trim().length < 3) found.title = "Enter a title of at least 3 characters.";
    if (draft.topic_concept.trim().length < 2) found.topic_concept = "Enter the topic or concept.";
    if (draft.problem_statement.trim().length < 20) found.problem_statement = "Write at least 20 characters of student instructions.";
    if (draft.activity_type === "challenge" && !draft.reference_solution_code.trim()) {
      found.reference_solution_code = "Add the reference solution so grading can be validated.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setNotice(null);
    try {
      const body: Record<string, unknown> = {
        course_id: courseId,
        activity_type: draft.activity_type,
        title: draft.title.trim(),
        topic_concept: draft.topic_concept.trim(),
        problem_statement: draft.problem_statement.trim(),
        difficulty_level: draft.difficulty_level,
        xp_reward: draft.xp_reward,
        opens_at: draft.opens_at ? new Date(draft.opens_at).toISOString() : null,
        closes_at: draft.closes_at ? new Date(draft.closes_at).toISOString() : null,
      };
      if (draft.activity_type === "challenge") {
        body.starter_code = draft.starter_code;
        body.reference_solution_code = draft.reference_solution_code;
        body.test_cases = [];
      } else {
        body.quiz_questions = {
          questions: [
            {
              id: "q1",
              prompt: "Replace this with the first question.",
              options: [
                { key: "A", text: "First option" },
                { key: "B", text: "Second option" },
              ],
              correct_answer: "A",
            },
          ],
        };
      }
      const result = await createActivity(body);
      await refreshCourses();
      router.push(`${courseHref(`/faculty/activities/${result.activity.activity_id}`)}&created=1`);
    } catch (caught) {
      setNotice({ tone: "error", text: `${getErrorMessage(caught)} Your entered values are still here.` });
    } finally {
      setBusy(false);
    }
  }

  const rows = data?.items || [];

  return (
    <>
      <PageHeading
        eyebrow="FACULTY WORKSPACE"
        title="Activities"
        description="Create, schedule and preview review lessons, quizzes and coding challenges. Grading content locks once a student attempts an activity."
        status={data ? <StatusChip state="active" label={`${data.total} in this view`} /> : undefined}
        actions={
          <Button variant="primary" data-tooltip="Create a new lesson, quiz or coding challenge" onClick={() => setCreateOpen((open) => !open)}>
            {createOpen ? "Close create form" : "Create activity"}
          </Button>
        }
      />

      {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}

      {createOpen ? (
        <section className="ws-panel" aria-labelledby="create-activity-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">NEW ACTIVITY</p>
              <h2 id="create-activity-title">Create an activity draft</h2>
            </div>
            <button type="button" className="ws-inline-link" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
          </div>
          <form className="ws-form-grid" onSubmit={(event) => void submitCreate(event)}>
            <div className="ws-field">
              <label htmlFor="create-type">Type</label>
              <select id="create-type" value={draft.activity_type} onChange={(event) => setDraft({ ...draft, activity_type: event.target.value })}>
                <option value="quiz">Quiz / review lesson</option>
                <option value="challenge">Coding challenge</option>
              </select>
            </div>
            <div className="ws-field">
              <label htmlFor="create-title">Title</label>
              <input id="create-title" value={draft.title} maxLength={255} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-invalid={Boolean(errors.title)} />
              <FieldError>{errors.title}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="create-topic">Topic or concept</label>
              <input id="create-topic" value={draft.topic_concept} maxLength={100} onChange={(event) => setDraft({ ...draft, topic_concept: event.target.value })} aria-invalid={Boolean(errors.topic_concept)} />
              <FieldError>{errors.topic_concept}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="create-difficulty">Difficulty</label>
              <select id="create-difficulty" value={draft.difficulty_level} onChange={(event) => setDraft({ ...draft, difficulty_level: Number(event.target.value) })}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    Level {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="ws-field full">
              <label htmlFor="create-problem">Student instructions</label>
              <textarea id="create-problem" rows={4} value={draft.problem_statement} onChange={(event) => setDraft({ ...draft, problem_statement: event.target.value })} aria-invalid={Boolean(errors.problem_statement)} />
              <FieldError>{errors.problem_statement}</FieldError>
            </div>
            {draft.activity_type === "challenge" ? (
              <>
                <div className="ws-field">
                  <label htmlFor="create-starter">Starter code</label>
                  <textarea id="create-starter" className="ws-code-input" rows={5} value={draft.starter_code} onChange={(event) => setDraft({ ...draft, starter_code: event.target.value })} />
                </div>
                <div className="ws-field">
                  <label htmlFor="create-reference">Reference solution (faculty only)</label>
                  <textarea id="create-reference" className="ws-code-input" rows={5} value={draft.reference_solution_code} onChange={(event) => setDraft({ ...draft, reference_solution_code: event.target.value })} aria-invalid={Boolean(errors.reference_solution_code)} />
                  <FieldError>{errors.reference_solution_code}</FieldError>
                </div>
              </>
            ) : null}
            <div className="ws-field">
              <label htmlFor="create-opens">Opens at (optional)</label>
              <input id="create-opens" type="datetime-local" value={draft.opens_at} onChange={(event) => setDraft({ ...draft, opens_at: event.target.value })} />
            </div>
            <div className="ws-field">
              <label htmlFor="create-closes">Closes at (optional)</label>
              <input id="create-closes" type="datetime-local" value={draft.closes_at} onChange={(event) => setDraft({ ...draft, closes_at: event.target.value })} />
            </div>
            <div className="ws-inline-actions full">
              <Button variant="primary" type="submit" disabled={busy}>
                {busy ? "Saving draft…" : "Save draft and continue"}
              </Button>
              <span className="ws-muted">The activity stays private until you preview and publish it.</span>
            </div>
          </form>
        </section>
      ) : null}

      <div className="ws-chip-row" role="group" aria-label="Filter activities by state">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`ws-filter-chip${status === option.value ? " is-selected" : ""}`}
            aria-pressed={status === option.value}
            data-tooltip={option.value === "all" ? "Show all activities" : `Show only ${option.label.toLowerCase()} activities`}
            onClick={() => updateQuery({ status: option.value === "all" ? null : option.value })}
          >
            {option.label}
            {data?.counts[option.value] !== undefined ? <span className="ws-chip-count">{data.counts[option.value]}</span> : null}
          </button>
        ))}
      </div>

      <Toolbar label="Activity filters">
        <SearchField value={search} onChange={setSearch} onSubmit={() => updateQuery({ q: search || null })} placeholder="Search activities" label="Search activities" />
        <SelectField
          label="Type"
          value={type}
          onChange={(value) => updateQuery({ type: value || null })}
          options={[
            { value: "quiz", label: "Quiz" },
            { value: "challenge", label: "Coding challenge" },
          ]}
          includeAll
          allLabel="All types"
        />
        {status !== "all" || type || appliedSearch ? (
          <Button variant="quiet" onClick={() => { setSearch(""); updateQuery({ status: null, type: null, q: null }); }}>
            Clear filters
          </Button>
        ) : null}
      </Toolbar>

      {error ? (
        <Notice tone="error">
          Activities could not load. {error}{" "}
          <button type="button" className="ws-inline-link" onClick={reload}>Retry</button>
        </Notice>
      ) : null}
      {loading && !data ? <LoadingPanel label="Loading activities…" /> : null}

      {!loading && data && rows.length === 0 ? (
        <EmptyState
          title={status !== "all" || type || appliedSearch ? "No activities match these filters" : "No activities yet"}
          action={<Button variant="primary" onClick={() => setCreateOpen(true)}>Create activity</Button>}
        >
          {status !== "all" || type || appliedSearch
            ? "Try another state or search term, or clear the filters."
            : "Create a review lesson, quiz or coding challenge, then preview it before publishing."}
        </EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <ul className="ws-list" aria-label="Activities">
          {rows.map((activity) => {
            const base = courseHref(`/faculty/activities/${activity.activity_id}`);
            const href = `${base}${base.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(
              `/faculty/activities?${searchParams.toString()}`,
            )}`;
            return (
              <li className="ws-row" key={activity.activity_id}>
                <div className="ws-row-main">
                  <strong>{activity.title || activity.topic_concept}</strong>
                  <p>
                    {activity.activity_type === "quiz" ? "Quiz / review" : "Coding challenge"} · {activity.topic_concept} ·{" "}
                    {activity.activity_type === "quiz"
                      ? `${activity.question_count} questions`
                      : `${activity.test_case_count} grading cases`}{" "}
                    · version {activity.version_number}
                  </p>
                  <span className="ws-row-meta">
                    {activity.state === "scheduled"
                      ? `Opens ${formatDateTime(activity.opens_at)}`
                      : activity.state === "closed"
                        ? `Closed ${formatDateTime(activity.closes_at)}`
                        : `Created ${formatDateTime(activity.created_at)}`}
                    {activity.closes_at ? ` · closes ${formatDateTime(activity.closes_at)}` : ""} · {activity.attempt_count}{" "}
                    attempt{activity.attempt_count === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="ws-row-actions">
                  <StatusChip state={activity.state} label={activityStateLabel[activity.state]} />
                  {activity.activity_type === "challenge" ? (
                    <StatusChip
                      state={activity.judge0_verified ? "ready" : "pending"}
                      label={activity.judge0_verified ? "Judge0 passed" : "Needs verification"}
                      tone={activity.judge0_verified ? "good" : "wait"}
                      tooltip={activity.judge0_verified
                        ? "Solution ran successfully against Judge0 test cases"
                        : "Run this challenge through Judge0 before publishing"}
                    />
                  ) : null}
                  {activity.grading_locked ? (
                    <StatusChip state="pending" label="Grading locked" tone="wait" tooltip="A student has attempted this, so graded content is locked; edits open a new version" />
                  ) : null}
                  <Link
                    className="button button-outline small"
                    href={href}
                    data-tooltip={activity.grading_locked
                      ? "Open a new editable version of this activity"
                      : "Open this activity in the editor"}
                  >
                    {activity.grading_locked ? "Open / new version" : "Open editor"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="ws-footnote">Draft and unpublished activities are never visible to students.</p>
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="activities">
      <FacultyActivities />
    </WorkspaceSuspense>
  );
}
