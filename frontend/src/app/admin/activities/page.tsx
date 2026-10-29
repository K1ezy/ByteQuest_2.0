"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "@/lib/api";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  Button,
  ConfirmDialog,
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
  adminArchiveActivity,
  activityStateLabel,
  formatDateTime,
  fromDateTimeInput,
  getActivityImpact,
  toDateTimeInput,
  updateAvailability,
  type AdminActivity,
  type AdminActivityList,
} from "@/lib/workspace";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "attention", label: "Needs attention" },
  { value: "scheduled", label: "Scheduled" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

function AdminActivities() {
  const { courses } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const courseFilter = searchParams.get("course") || "";
  const status = searchParams.get("status") || "all";
  const type = searchParams.get("type") || "";
  const appliedSearch = searchParams.get("q") || "";
  const focusedActivity = searchParams.get("activity") || "";
  const [search, setSearch] = useState(appliedSearch);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState<"availability" | "archive" | "">("");
  const [impact, setImpact] = useState<{ activity: AdminActivity; effect: { enrolled_students: number; attempts_recorded: number; note: string } } | null>(null);
  const [impactError, setImpactError] = useState("");
  const [target, setTarget] = useState<AdminActivity | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AdminActivity | null>(null);
  const [schedule, setSchedule] = useState({ opensAt: "", closesAt: "", closed: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(appliedSearch);
  }, [appliedSearch]);

  const path = useMemo(
    () =>
      `/admin/activities?${new URLSearchParams({
        ...(courseFilter ? { course_id: courseFilter } : {}),
        ...(status && status !== "all" ? { status } : {}),
        ...(type ? { type } : {}),
        ...(appliedSearch ? { search: appliedSearch } : {}),
      }).toString()}`,
    [appliedSearch, courseFilter, status, type],
  );
  const { data, error, loading, reload } = useApi<AdminActivityList>(path);

  useEffect(() => {
    if (!focusedActivity || !data) return;
    const activity = data.items.find((item) => item.activity_id === focusedActivity);
    if (activity) void openAvailability(activity);
  }, [data, focusedActivity]);

  function updateQuery(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  async function openAvailability(activity: AdminActivity) {
    setTarget(activity);
    setImpact(null);
    setImpactError("");
    setErrors({});
    setSchedule({ opensAt: toDateTimeInput(activity.opens_at), closesAt: toDateTimeInput(activity.closes_at), closed: Boolean(activity.closed_at) });
    try {
      const result = await getActivityImpact(activity.activity_id);
      setImpact(result);
    } catch (caught) {
      setImpactError(getErrorMessage(caught));
    }
  }

  async function saveAvailability() {
    if (!target) return;
    const found: Record<string, string> = {};
    if (schedule.opensAt && schedule.closesAt && new Date(schedule.closesAt) <= new Date(schedule.opensAt)) {
      found.closesAt = "The closing time must be after the opening time.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy("availability");
    try {
      const result = await updateAvailability(target.activity_id, {
        opens_at: fromDateTimeInput(schedule.opensAt),
        closes_at: fromDateTimeInput(schedule.closesAt),
        closed: schedule.closed,
      });
      setNotice({ tone: "success", text: result.message });
      setTarget(null);
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: `${getErrorMessage(caught)} The previous availability is still in effect.` });
    } finally {
      setBusy("");
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setBusy("archive");
    try {
      const result = await adminArchiveActivity(archiveTarget.activity_id);
      setNotice({ tone: "success", text: result.message });
      setArchiveTarget(null);
      reload();
    } catch (caught) {
      setNotice({ tone: "error", text: getErrorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  const rows = data?.items || [];

  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="Activity operations"
        description="Review and change availability or archival. Quiz keys, hidden tests and grading rules stay with assigned faculty."
        status={data ? <StatusChip state="active" label={`${data.total} in this view`} /> : undefined}
      />

      {notice ? <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice> : null}

      <div className="ws-chip-row" role="group" aria-label="Filter activities by availability">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`ws-filter-chip${status === option.value ? " is-selected" : ""}`}
            aria-pressed={status === option.value}
            onClick={() => updateQuery({ status: option.value === "all" ? null : option.value })}
          >
            {option.label}
            {data?.counts[option.value] !== undefined ? <span className="ws-chip-count">{data.counts[option.value]}</span> : null}
          </button>
        ))}
      </div>

      <Toolbar label="Activity filters">
        <SearchField value={search} onChange={setSearch} onSubmit={() => updateQuery({ q: search || null })} placeholder="Search activities" label="Search activities" />
        <SelectField label="Course" value={courseFilter} onChange={(value) => updateQuery({ course: value || null })} options={courses.map((course) => ({ value: course.id, label: course.title }))} includeAll allLabel="All courses" />
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
        {courseFilter || status !== "all" || type || appliedSearch ? (
          <Button variant="quiet" onClick={() => { setSearch(""); updateQuery({ course: null, status: null, type: null, q: null }); }}>
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
        <EmptyState title="No activities match this view">Change the course, availability or search, or clear the filters.</EmptyState>
      ) : null}

      {rows.length > 0 ? (
        <div className="ws-table-wrap">
          <table className="ws-table">
            <caption className="sr-only">Activity availability</caption>
            <thead>
              <tr>
                <th scope="col">Activity</th>
                <th scope="col">Course</th>
                <th scope="col">Type</th>
                <th scope="col">Availability</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((activity) => (
                <tr key={activity.activity_id}>
                  <td data-label="Activity">
                    <strong>{activity.title || activity.topic_concept}</strong>
                    <span className="ws-row-meta">{activity.topic_concept} · v{activity.version_number}</span>
                    <span className="ws-row-meta">{activity.attempt_count} attempt(s) · {activity.enrolled_students ?? 0} enrolled</span>
                  </td>
                  <td data-label="Course">{activity.course?.title || "Unassigned"}</td>
                  <td data-label="Type">{activity.activity_type === "quiz" ? "Quiz" : "Challenge"}</td>
                  <td data-label="Availability">
                    <StatusChip state={activity.state} label={activityStateLabel[activity.state] || activity.state} />
                    <span className="ws-row-meta">
                      {activity.opens_at ? `Opens ${formatDateTime(activity.opens_at)}` : "No opening time"}
                      {activity.closes_at ? ` · closes ${formatDateTime(activity.closes_at)}` : ""}
                    </span>
                  </td>
                  <td data-label="Action">
                    <div className="ws-inline-actions">
                      <Button variant="outline" disabled={busy !== ""} onClick={() => void openAvailability(activity)}>
                        Change availability
                      </Button>
                      {activity.archived_at ? (
                        <span className="ws-muted">Archived</span>
                      ) : (
                        <Button variant="danger" disabled={busy !== ""} onClick={() => setArchiveTarget(activity)}>
                          Archive
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="ws-footnote">Availability changes affect future student access only; existing attempts and scores stay intact.</p>

      <ConfirmDialog
        open={Boolean(target)}
        title="Change activity availability"
        confirmLabel="Confirm availability"
        busy={busy === "availability"}
        onCancel={() => setTarget(null)}
        onConfirm={() => void saveAvailability()}
      >
        {target ? (
          <div className="ws-stack">
            <p>
              <strong>{target.title || target.topic_concept}</strong> · {target.course?.title}
            </p>
            {impactError ? <Notice tone="error">{impactError}</Notice> : null}
            {impact ? (
              <div className="ws-soft">
                <strong>Impact</strong>
                <p>
                  {impact.effect.enrolled_students} enrolled student(s) · {impact.effect.attempts_recorded} recorded
                  attempt(s). {impact.effect.note}
                </p>
                <p>
                  Current state: <strong>{activityStateLabel[target.state] || target.state}</strong>.
                </p>
              </div>
            ) : (
              <LoadingPanel label="Loading impact…" />
            )}
            <div className="ws-form-grid">
              <div className="ws-field">
                <label htmlFor="availability-opens">Opens at</label>
                <input id="availability-opens" type="datetime-local" value={schedule.opensAt} onChange={(event) => setSchedule({ ...schedule, opensAt: event.target.value })} />
              </div>
              <div className="ws-field">
                <label htmlFor="availability-closes">Closes at</label>
                <input id="availability-closes" type="datetime-local" value={schedule.closesAt} onChange={(event) => setSchedule({ ...schedule, closesAt: event.target.value })} aria-invalid={Boolean(errors.closesAt)} />
                <FieldError>{errors.closesAt}</FieldError>
              </div>
              <label className="ws-check full">
                <input type="checkbox" checked={schedule.closed} onChange={(event) => setSchedule({ ...schedule, closed: event.target.checked })} />
                <span>Close the activity to new student access now</span>
              </label>
            </div>
            <p className="ws-muted">Times use Asia/Manila and are validated before saving.</p>
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive this activity"
        confirmLabel="Archive activity"
        tone="danger"
        busy={busy === "archive"}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => void confirmArchive()}
      >
        {archiveTarget ? (
          <>
            <p>
              <strong>{archiveTarget.title || archiveTarget.topic_concept}</strong> stops being available to students in{" "}
              {archiveTarget.course?.title || "its course"}.
            </p>
            <ul className="ws-plain-list">
              <li>{archiveTarget.attempt_count} existing attempt(s) and their scores remain available.</li>
              <li>Review lessons, quiz keys and hidden tests are not changed by this action.</li>
            </ul>
          </>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="activity operations">
      <AdminActivities />
    </WorkspaceSuspense>
  );
}
