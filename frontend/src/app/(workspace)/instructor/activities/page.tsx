"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/api";
import { ActivityRow } from "@/components/instructor/activity-identity";
import { activityListHref } from "@/lib/instructor-activity";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { InlineEmpty, InlineError, InstructorIcon, PageHeader, RowSkeleton } from "@/components/instructor/course-ui";
import {
  Notice,
  SearchField,
  SelectField,
  useApi,
} from "@/components/workspace/ui";
import {
  createActivity,
  createActivityVersion,
  getActivity,
  type ActivityList,
  type ActivityListItem,
} from "@/lib/workspace";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "needs-review", label: "Needs review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

function FacultyActivities() {
  const { activeCourse, courseId, courseHref, refreshCourses } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "all";
  const type = searchParams.get("type") || "";
  const review = searchParams.get("review") || "";
  const material = searchParams.get("material") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const highlight = searchParams.get("highlight");
  const published = searchParams.get("published") === "1";
  const focused = useRef<string | null>(null);
  const appliedSearch = searchParams.get("q") || "";
  const [search, setSearch] = useState(appliedSearch);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(appliedSearch);
  }, [appliedSearch]);

  useEffect(() => {
    if (courseId && searchParams.get("create") === "1") {
      router.replace(courseHref("/instructor/activities/new?method=manual"));
    }
  }, [courseHref, courseId, router, searchParams]);

  const path = useMemo(
    () =>
      courseId
        ? `/faculty/activities?${new URLSearchParams({
            course_id: courseId,
            status: status === "needs-review" ? "all" : status,
            ...(status === "needs-review" || review ? { review: status === "needs-review" ? status : review } : {}),
            ...(material ? { material_id: material } : {}),
            ...(from ? { date_from: from.length === 10 ? `${from}T00:00:00+08:00` : from } : {}),
            ...(to ? { date_to: to.length === 10 ? `${to}T23:59:59.999+08:00` : to } : {}),
            ...(type ? { type } : {}),
            ...(appliedSearch ? { search: appliedSearch } : {}),
          }).toString()}`
        : null,
    [appliedSearch, courseId, from, material, review, status, to, type],
  );
  const { data, error, loading, reload } = useApi<ActivityList>(path, true);

  function updateQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("highlight");
    next.delete("published");
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${window.location.pathname}?${next.toString()}`, { scroll: false });
  }

  const attention = searchParams.get("sort") === "attention";
  const rows = [...(data?.items || [])];
  if (attention) rows.sort((a,b) => (b.health?.stuck ?? 0) - (a.health?.stuck ?? 0) ||
    (a.health?.pass_rate ?? 2) - (b.health?.pass_rate ?? 2) || (a.title || a.topic_concept).localeCompare(b.title || b.topic_concept));
  const highlighted = highlight ? rows.find((row) => row.activity_id === highlight) : undefined;
  if (highlighted) {
    rows.splice(rows.indexOf(highlighted), 1);
    rows.unshift(highlighted);
  }

  useEffect(() => {
    if (!highlighted || highlighted.activity_id === focused.current) return;
    const row = document.getElementById(`activity-${highlighted.activity_id}`);
    if (!row) return;
    focused.current = highlighted.activity_id;
    row.scrollIntoView({ block: "nearest" });
    row.focus({ preventScroll: true });
  }, [highlighted]);

  const filtered = Boolean(status !== "all" || type || appliedSearch || review || material || from || to);

  async function copyActivity(activity: ActivityListItem, kind: "version" | "duplicate") {
    if (!courseId || rowBusy) return;
    setRowBusy(activity.activity_id);
    setNotice(null);
    try {
      const result = kind === "version" ? await createActivityVersion(activity.activity_id) : await (async () => {
        const source = await getActivity(activity.activity_id);
        return createActivity({
          course_id: courseId, activity_type: source.activity_type, language: activity.language,
          workshop_id: source.destination_workshop?.id,
          title: `Copy of ${source.title || source.topic_concept}`.slice(0, 255), topic_concept: source.topic_concept,
          problem_statement: source.problem_statement, difficulty_level: source.difficulty_level, xp_reward: source.xp_reward,
          pass_mark_percent: source.pass_mark_percent, starter_code: source.starter_code, reference_solution_code: source.reference_solution_code,
          quiz_questions: source.quiz_questions, test_cases: source.test_cases?.map((test) => ({
            order_index: test.order_index, stdin: test.stdin, expected_stdout: test.expected_stdout,
            time_limit_ms: test.time_limit_ms, memory_limit_kb: test.memory_limit_kb, is_hidden: test.is_hidden, weight: test.weight,
          })),
        });
      })();
      router.push(activityListHref(courseId, result.activity.activity_id));
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
        subtitle={activeCourse?.title}
        actions={courseId ? (
          <Link className={`ic-button${highlighted ? "" : " ic-primary"}`} href={courseHref("/instructor/activities/new")}>
            <InstructorIcon name="plus" />New Activity
          </Link>
        ) : undefined}
      />

      {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}


      <div className="ws-chip-row" role="group" aria-label="Filter activities by state">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`ws-filter-chip${status === option.value ? " is-selected" : ""}`}
            aria-pressed={status === option.value}
            data-tooltip={option.value === "all" ? "Show all activities" : `Show only ${option.label.toLowerCase()} activities`}
            onClick={() => updateQuery({ status: option.value === "all" ? null : option.value, review: null })}
          >
            {option.label}
            {data?.counts[option.value] !== undefined ? <span className="ws-chip-count">{data.counts[option.value]}</span> : null}
          </button>
        ))}
      </div>

      <div className="ic-activity-filters" role="region" aria-label="Activity filters">
        <SearchField value={search} onChange={setSearch} onSubmit={() => updateQuery({ q: search || null })} placeholder="Search activities" label="Search activities" />
        <SelectField label="Sort" value={attention ? "attention" : ""} onChange={v => updateQuery({sort:v || null})}
          options={[{value:"",label:"Newest first"},{value:"attention",label:"Needs attention first"}]}/>
        <SelectField label="Type" value={type} onChange={(value) => updateQuery({ type: value || null })} options={[
          { value: "quiz", label: "Quiz" }, { value: "challenge", label: "Coding challenge" },
        ]} includeAll allLabel="All types" />
        {filtered ? (
          <button type="button" className="ic-button" onClick={() => {
            setSearch("");
            updateQuery({ status: null, type: null, q: null, review: null, material: null, from: null, to: null });
          }}>Clear filters</button>
        ) : null}
      </div>
      {status === "draft" || status === "needs-review" || review || material || from || to ? (
        <details className="ic-review-filters" open={Boolean(review || material || from || to) || undefined}>
          <summary>Review filters</summary>
          <div className="ic-activity-filters">
            {status !== "needs-review" ? <SelectField label="Review status" value={review}
              onChange={(value) => updateQuery({ review: value || null, ...(value === "published" ? { status: null } : {}) })}
              options={[
                { value: "open", label: "All unpublished" }, { value: "pending", label: "Awaiting review" },
                { value: "ready", label: "Review confirmed" }, { value: "rejected", label: "Changes requested" },
                { value: "published", label: "Published" },
              ]} includeAll allLabel="Any review status" /> : null}
            <SelectField label="Source PDF" value={material} onChange={(value) => updateQuery({ material: value || null })}
              options={(data?.filters?.materials ?? []).map((item) => ({ value: item.document_id, label: item.title }))}
              includeAll allLabel="All source PDFs" />
            <label className="ws-field">Created from <input type="date" value={from.slice(0, 10)}
              onChange={(event) => updateQuery({ from: event.target.value || null })} /></label>
            <label className="ws-field">Created through <input type="date" value={to.slice(0, 10)}
              onChange={(event) => updateQuery({ to: event.target.value || null })} /></label>
          </div>
        </details>
      ) : null}

      {error ? <InlineError onRetry={reload} /> : loading && !data ? <RowSkeleton /> : null}
      {!error && !loading && data && !rows.length ? (
        <InlineEmpty>{filtered ? "No activities match these filters." : "No activities yet."}</InlineEmpty>
      ) : null}

      {!error && rows.length > 0 ? (
        <ul className="ic-list" aria-label="Activities">
          {rows.map((activity) => {
            const mayAnalyze = activity.review_status === "published" && activity.state !== "archived";
            return <ActivityRow key={activity.activity_id} activity={activity} highlighted={highlight === activity.activity_id} published={published}
              menu={<details className="ic-row-menu" onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }}>
                <summary className="ic-button" aria-label={"More actions for " + (activity.title || activity.topic_concept)}>⋯</summary>
                <div className="ic-menu-options">
                  {mayAnalyze && <Link className="ic-button" href={courseHref("/instructor/activities/" + activity.activity_id + "/analysis")}>Analysis</Link>}
                  <button type="button" className="ic-button" disabled={rowBusy !== null} onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                    void copyActivity(activity, "version");
                  }}>New version</button>
                  <button type="button" className="ic-button" disabled={rowBusy !== null} onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                    void copyActivity(activity, "duplicate");
                  }}>Duplicate</button>
                  <button type="button" className="ic-button" disabled title="Only administrators can archive activities at present">Archive</button>
                </div>
              </details>} />;
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function Page() {
  const { courseId } = useWorkspace();
  return <FacultyActivities key={courseId} />;
}
