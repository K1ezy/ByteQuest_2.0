"use client";

import { fromManilaDateTimeInput, formatManilaDateTime } from "@/lib/activity-date";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getErrorMessage } from "@/lib/api";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { DataRow, InlineEmpty, InlineError, InstructorIcon, PageHeader, RowSkeleton, StatusBadge } from "@/components/instructor/course-ui";
import type { ProgrammingLanguage } from "@/lib/types";
import {
  Button,
  FieldError,
  Notice,
  SearchField,
  SelectField,
  useApi,
} from "@/components/workspace/ui";
import {
  activityStateLabel,
  createActivity,
  createActivityVersion,
  getActivity,
  type ActivityList,
  type ActivityListItem,
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
  const { courseId, courseHref, refreshCourses, profile } = useWorkspace();
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
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({
    activity_type: "quiz",
    // Null until the instructor picks one: then the class's language is shown (see createLanguage).
    language: null as ProgrammingLanguage | null,
    title: "",
    topic_concept: "",
    problem_statement: "",
    difficulty_level: 2,
    xp_reward: 30,
    reference_solution_code: "",
    starter_code: "",
    exam_only: false,
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
  const { data, error, loading, reload } = useApi<ActivityList>(path, true);

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
    const opensAt = fromManilaDateTimeInput(draft.opens_at);
    const closesAt = fromManilaDateTimeInput(draft.closes_at);
    if (draft.opens_at && !opensAt) found.opens_at = "Enter a valid opening time in Asia/Manila.";
    if (draft.closes_at && !closesAt) found.closes_at = "Enter a valid closing time in Asia/Manila.";
    if (opensAt && closesAt && closesAt <= opensAt) found.closes_at = "The closing time must be after the opening time.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setNotice(null);
    try {
      const body: Record<string, unknown> = {
        course_id: courseId,
        activity_type: draft.activity_type,
        exam_only: draft.exam_only,
        language: createLanguage,
        title: draft.title.trim(),
        topic_concept: draft.topic_concept.trim(),
        problem_statement: draft.problem_statement.trim(),
        difficulty_level: draft.difficulty_level,
        xp_reward: draft.xp_reward,
        opens_at: opensAt,
        closes_at: closesAt,
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
      router.push(`${courseHref(`/instructor/activities/${result.activity.activity_id}`)}&created=1`);
    } catch (caught) {
      setNotice({ tone: "error", text: `${getErrorMessage(caught)} Your entered values are still here.` });
    } finally {
      setBusy(false);
    }
  }

  const rows = data?.items || [];
  // Default to the language this class already uses; the instructor's own track only for an empty course.
  const createLanguage = draft.language ?? rows.find((row) => row.language)?.language ?? profile.enrolled_language;

  async function copyActivity(activity: ActivityListItem, kind: "version" | "duplicate") {
    if (!courseId || rowBusy) return;
    setRowBusy(activity.activity_id);
    setNotice(null);
    try {
      const result = kind === "version" ? await createActivityVersion(activity.activity_id) : await (async () => {
        const source = await getActivity(activity.activity_id);
        return createActivity({
          course_id: courseId, activity_type: source.activity_type, language: activity.language,
          title: `Copy of ${source.title || source.topic_concept}`.slice(0, 255), topic_concept: source.topic_concept,
          problem_statement: source.problem_statement, difficulty_level: source.difficulty_level, xp_reward: source.xp_reward,
          pass_mark_percent: source.pass_mark_percent, starter_code: source.starter_code, reference_solution_code: source.reference_solution_code,
          quiz_questions: source.quiz_questions, test_cases: source.test_cases?.map((test) => ({
            order_index: test.order_index, stdin: test.stdin, expected_stdout: test.expected_stdout,
            time_limit_ms: test.time_limit_ms, memory_limit_kb: test.memory_limit_kb, is_hidden: test.is_hidden, weight: test.weight,
          })),
        });
      })();
      router.push(courseHref(`/instructor/activities/${result.activity.activity_id}`));
      await refreshCourses();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div className="ic-activity-shell">
      <PageHeader
        title="Activities"
        subtitle="Create, schedule and preview lessons, quizzes and coding challenges."
        actions={<button type="button" className={`ic-button${createOpen ? "" : " ic-primary"}`} onClick={() => setCreateOpen((open) => !open)}>
          {!createOpen ? <InstructorIcon name="plus" /> : null}{createOpen ? "Close create form" : "New activity"}
        </button>}
      />
      <nav className="ic-activity-subnav" aria-label="Activity tools"><Link href={courseHref("/instructor/materials")}>Materials</Link><Link href={courseHref("/instructor/review")}>Review Queue</Link><Link href="/workshops">Workshops</Link><Link href="/instructor/preview">Student Preview</Link></nav>

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
              <label htmlFor="create-language">Language</label>
              <select id="create-language" value={createLanguage} onChange={(event) => setDraft({ ...draft, language: event.target.value as ProgrammingLanguage })}>
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>
            </div>
            <div className="ws-field">
              <label htmlFor="create-title">Title</label>
              <input id="create-title" value={draft.title} maxLength={255} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-invalid={Boolean(errors.title)} />
              <FieldError>{errors.title}</FieldError>
            </div>
            <label className="ws-checkbox-row">
              <input type="checkbox" checked={draft.exam_only} onChange={(event) => setDraft({ ...draft, exam_only: event.target.checked })} />
              Exam-only activity for a restricted assessment
            </label>
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
                  <label htmlFor="create-reference">Reference solution (instructors only)</label>
                  <textarea id="create-reference" className="ws-code-input" rows={5} value={draft.reference_solution_code} onChange={(event) => setDraft({ ...draft, reference_solution_code: event.target.value })} aria-invalid={Boolean(errors.reference_solution_code)} />
                  <FieldError>{errors.reference_solution_code}</FieldError>
                </div>
              </>
            ) : null}
            <div className="ws-field">
              <label htmlFor="create-opens">Opens at (optional, Manila time)</label>
              <input id="create-opens" type="datetime-local" value={draft.opens_at} onChange={(event) => setDraft({ ...draft, opens_at: event.target.value })} aria-invalid={Boolean(errors.opens_at)} />
              <FieldError>{errors.opens_at}</FieldError>
            </div>
            <div className="ws-field">
              <label htmlFor="create-closes">Closes at (optional, Manila time)</label>
              <input id="create-closes" type="datetime-local" value={draft.closes_at} onChange={(event) => setDraft({ ...draft, closes_at: event.target.value })} aria-invalid={Boolean(errors.closes_at)} />
              <FieldError>{errors.closes_at}</FieldError>
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

      <div className="ic-activity-filters" role="region" aria-label="Activity filters">
        <SearchField value={search} onChange={setSearch} onSubmit={() => updateQuery({ q: search || null })} placeholder="Search activities" label="Search activities" />
        <SelectField label="Type" value={type} onChange={(value) => updateQuery({ type: value || null })} options={[
          { value: "quiz", label: "Quiz" }, { value: "challenge", label: "Coding challenge" },
        ]} includeAll allLabel="All types" />
        {status !== "all" || type || appliedSearch ? (
          <button type="button" className="ic-button" onClick={() => { setSearch(""); updateQuery({ status: null, type: null, q: null }); }}>Clear filters</button>
        ) : null}
      </div>

      {error ? <InlineError onRetry={reload} /> : loading && !data ? <RowSkeleton /> : null}
      {!error && !loading && data && !rows.length ? (
        <InlineEmpty>{status !== "all" || type || appliedSearch ? "No activities match these filters." : "No activities yet."}</InlineEmpty>
      ) : null}

      {!error && rows.length > 0 ? (
        <ul className="ic-list" aria-label="Activities">
          {rows.map((activity) => {
            const base = courseHref("/instructor/activities/" + activity.activity_id);
            const href = base + (base.includes("?") ? "&" : "?") + "returnTo=" + encodeURIComponent("/instructor/activities?" + searchParams.toString());
            const items = activity.activity_type === "quiz"
              ? activity.question_count + (activity.question_count === 1 ? " question" : " questions")
              : activity.test_case_count + (activity.test_case_count === 1 ? " grading case" : " grading cases");
            const meta = [activity.activity_type === "quiz" ? "Quiz / review" : "Coding challenge", items, "v" + activity.version_number,
              activity.attempt_count + (activity.attempt_count === 1 ? " attempt" : " attempts")].join(" · ");
            const mayAnalyze = activity.review_status === "published" && activity.state !== "archived";
            return <DataRow key={activity.activity_id} title={activity.title || activity.topic_concept} href={href}
              status={<StatusBadge tone={activity.state === "archived" ? "warning" : "dot"}>{activityStateLabel[activity.state]}</StatusBadge>}
              description={<>
                {activity.title && activity.topic_concept ? <div>{activity.topic_concept}</div> : null}
                <div>{meta}</div>
                {activity.state === "scheduled" && activity.opens_at ? <div>Opens {formatManilaDateTime(activity.opens_at)}</div> : null}
              </>}
              indicators={<>
                {activity.activity_type === "challenge" ? (
                  <span className={activity.judge0_verified ? "ic-judge-passed" : "ic-judge-pending"} role="img"
                    aria-label={activity.judge0_verified ? "Judge0 passed" : "Needs verification"}
                    data-tooltip={activity.judge0_verified ? "Judge0 passed" : "Needs verification"}>
                    <InstructorIcon name={activity.judge0_verified ? "check" : "warning"} />
                  </span>
                ) : null}
                {activity.grading_locked ? <span role="img" aria-label="Grading locked" data-tooltip="Grading locked"><InstructorIcon name="lock" /></span> : null}
              </>}
              action={<Link className="ic-button" href={href}>Edit</Link>}
              menu={<details className="ic-row-menu" onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }}>
                <summary className="ic-button" aria-label={"More actions for " + (activity.title || activity.topic_concept)}>⋯</summary>
                <div className="ic-menu-options">
                  {mayAnalyze ? <Link className="ic-button" href={courseHref("/instructor/activities/" + activity.activity_id + "/analysis")}>Analysis</Link> : null}
                  <button type="button" className="ic-button" disabled={rowBusy !== null} onClick={() => void copyActivity(activity, "version")}>New version</button>
                  <button type="button" className="ic-button" disabled={rowBusy !== null} onClick={() => void copyActivity(activity, "duplicate")}>Duplicate</button>
                  <button type="button" className="ic-button" disabled title="Only administrators can archive activities at present">Archive</button>
                </div>
              </details>} />;
          })}
        </ul>
      ) : null}
      <p className="ws-footnote">Draft and unpublished activities are never visible to students.</p>
    </div>
  );
}

export default function Page() {
  const { courseId } = useWorkspace();
  return <FacultyActivities key={courseId} />;
}
