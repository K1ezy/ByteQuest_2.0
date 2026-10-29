"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button,
  EmptyState,
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
  draftStateLabel,
  formatDateTime,
  type DraftList,
  type DraftListItem,
} from "@/lib/workspace";

const STATUS_OPTIONS = [
  { value: "open", label: "Open drafts" },
  { value: "pending", label: "Awaiting review" },
  { value: "ready", label: "Review confirmed" },
  { value: "rejected", label: "Rejected" },
  { value: "published", label: "Published" },
  { value: "all", label: "All statuses" },
];

function ReviewQueue() {
  const { courseId, courseHref, refreshCourses } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "open";
  const material = searchParams.get("material") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const appliedSearch = searchParams.get("q") || "";
  const [search, setSearch] = useState(appliedSearch);

  useEffect(() => {
    // Keep the visible search box aligned with a cleared URL filter.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(appliedSearch);
  }, [appliedSearch]);

  const path = useMemo(
    () =>
      courseId
        ? `/faculty/drafts?${new URLSearchParams({
            course_id: courseId,
            status,
            ...(material ? { material_id: material } : {}),
            ...(from ? { date_from: from } : {}),
            ...(to ? { date_to: to } : {}),
            ...(appliedSearch ? { search: appliedSearch } : {}),
          }).toString()}`
        : null,
    [appliedSearch, courseId, from, material, status, to],
  );
  const { data, error, loading, reload } = useApi<DraftList>(path);

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const returnTo = `${pathname}?${searchParams.toString()}`;
  const counts = data?.counts || {};
  const rows = data?.items || [];
  const cleared = Boolean(material || from || to || appliedSearch || status !== "open");

  return (
    <>
      <PageHeading
        eyebrow="FACULTY WORKSPACE"
        title="Review queue"
        description="Inspect each generated draft and its cited source pages before publishing. Saving never publishes."
        status={data ? <StatusChip state="active" label={`${data.total} in this view`} /> : undefined}
        actions={
          <Link className="button button-primary" href={courseHref("/faculty/materials")}>
            Upload material
          </Link>
        }
      />

      <div className="ws-chip-row" role="group" aria-label="Filter by review status">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`ws-filter-chip${status === option.value ? " is-selected" : ""}`}
            aria-pressed={status === option.value}
            onClick={() => updateParams({ status: option.value === "open" ? null : option.value })}
          >
            {option.label}
            {counts[option.value] !== undefined ? <span className="ws-chip-count">{counts[option.value]}</span> : null}
          </button>
        ))}
      </div>

      <Toolbar label="Review queue filters">
        <SearchField
          value={search}
          onChange={setSearch}
          onSubmit={() => updateParams({ q: search || null })}
          placeholder="Search drafts or topics"
          label="Search drafts"
        />
        <SelectField
          label="Material"
          value={material}
          onChange={(value) => updateParams({ material: value || null })}
          options={(data?.filters.materials || []).map((item) => ({
            value: item.document_id,
            label: `${item.title} · v${item.version_number}`,
          }))}
          includeAll
          allLabel="All materials"
        />
        <label className="ws-select">
          <span>Generated from</span>
          <input type="date" value={from} onChange={(event) => updateParams({ from: event.target.value || null })} />
        </label>
        <label className="ws-select">
          <span>Generated to</span>
          <input type="date" value={to} onChange={(event) => updateParams({ to: event.target.value || null })} />
        </label>
        {cleared ? (
          <Button variant="quiet" onClick={() => updateParams({ status: null, material: null, from: null, to: null, q: null })}>
            Clear filters
          </Button>
        ) : null}
      </Toolbar>

      {error ? (
        <Notice tone="error">
          The review queue could not load. {error}{" "}
          <button type="button" className="ws-inline-link" onClick={reload}>
            Retry
          </button>
        </Notice>
      ) : null}

      {loading && !data ? <LoadingPanel label="Loading drafts…" /> : null}

      {!loading && data && rows.length === 0 ? (
        <EmptyState
          title={status === "open" ? "No drafts need review" : "No drafts match these filters"}
          tone={status === "open" ? "success" : "neutral"}
          action={
            <div className="ws-inline-actions">
              <Link className="button button-outline small" href={courseHref("/faculty/materials")}>
                Upload material
              </Link>
              <Link className="button button-primary small" href={`${courseHref("/faculty/activities")}&create=1`}>
                Create activity
              </Link>
            </div>
          }
        >
          {status === "open"
            ? "Generated drafts appear here for review before students can see them. Upload a searchable PDF or create an activity to prepare the next lesson."
            : "Try another status, material, date range or search term. Your filters stay until you clear them."}
        </EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <ul className="ws-list" aria-label="Drafts">
          {rows.map((item) => (
            <DraftRow key={item.activity_id} item={item} courseId={courseId} returnTo={returnTo} onChanged={refreshCourses} />
          ))}
        </ul>
      ) : null}

      <p className="ws-footnote">
        Viewing or saving a draft never publishes it. Approval requires a separate confirmation with the student-visible
        preview.
      </p>
    </>
  );
}

function DraftRow({
  item,
  courseId,
  returnTo,
  onChanged,
}: {
  item: DraftListItem;
  courseId: string | null;
  returnTo: string;
  onChanged: () => Promise<void>;
}) {
  const href = `/faculty/review/${item.activity_id}?${new URLSearchParams({
    ...(courseId ? { course: courseId } : {}),
    returnTo,
  }).toString()}`;
  return (
    <li className="ws-row">
      <div className="ws-row-main">
        <strong>{item.title || item.topic_concept}</strong>
        <p>
          {item.activity_type === "quiz" ? "Quiz" : "Coding challenge"} · {item.topic_concept} ·{" "}
          {item.activity_type === "quiz" ? `${item.question_count} questions` : `${item.test_case_count} grading cases`}
        </p>
        <span className="ws-row-meta">
          {item.material ? (
            <>
              From <strong>{item.material.title}</strong> v{item.material.version_number}
              {item.material.archived_at ? " (archived)" : ""} ·{" "}
            </>
          ) : (
            "No cited material · "
          )}
          {item.citation_count} citation{item.citation_count === 1 ? "" : "s"} · updated {formatDateTime(item.updated_at)}
        </span>
        {item.rejection_reason ? <p className="ws-row-note">Review note: {item.rejection_reason}</p> : null}
      </div>
      <div className="ws-row-actions">
        <StatusChip state={item.draft_state} label={draftStateLabel[item.draft_state]} />
        {item.activity_type === "challenge" ? (
          <StatusChip
            state={item.judge0_verified ? "ready" : "pending"}
            label={item.judge0_verified ? "Judge0 passed" : "Needs verification"}
            tone={item.judge0_verified ? "good" : "wait"}
          />
        ) : null}
        <Link className="button button-outline small" href={href} onClick={() => void onChanged()}>
          {item.review_status === "published" ? "View draft" : "Review draft"}
        </Link>
      </div>
    </li>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="review queue">
      <ReviewQueue />
    </WorkspaceSuspense>
  );
}
