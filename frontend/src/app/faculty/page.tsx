"use client";

import Link from "next/link";
import { useWorkspace, WorkspaceSuspense } from "@/components/workspace/workspace-provider";
import {
  EmptyState,
  LoadingPanel,
  Notice,
  PageHeading,
  StatCard,
  StatusChip,
  Button,
} from "@/components/workspace/ui";
import { formatDateTime, type FacultyDashboard, type QueueItem } from "@/lib/workspace";
import { useApi } from "@/components/workspace/ui";

const ACTION_LABEL: Partial<Record<QueueItem["kind"], string>> = {
  draft: "Review draft",
  material: "View material",
  activity: "View activity",
};

function FacultyDashboardPage() {
  const { courseId, activeCourse, profile } = useWorkspace();
  const { data, error, loading, reload } = useApi<FacultyDashboard>(
    courseId ? `/faculty/dashboard?course_id=${courseId}` : null,
  );

  if (loading && !data) return <LoadingPanel label="Loading your teaching dashboard…" />;
  if (error && !data) {
    return (
      <section className="ws-panel" role="alert">
        <PageHeading eyebrow="FACULTY WORKSPACE" title="Dashboard unavailable" description={error} />
        <div className="ws-inline-actions">
          <Button variant="primary" onClick={reload}>
            Try again
          </Button>
        </div>
      </section>
    );
  }
  if (!data) return <EmptyState title="No course selected">Choose an assigned course to see its tasks.</EmptyState>;

  const queue = data.action_queue;
  const draftCardHref = data.queue_hrefs.drafts;

  return (
    <>
      <PageHeading
        eyebrow="FACULTY WORKSPACE"
        title={`Good day, ${profile.display_name || "faculty"}`}
        description={
          <>
            Your next teaching tasks in <strong>{data.course.title}</strong>.
          </>
        }
        status={<span className="ws-muted">{data.counts.active_learners} active learners</span>}
        actions={
          <Button variant="outline" onClick={reload}>
            Refresh
          </Button>
        }
      />

      <div className="ws-stat-grid" aria-label="Course status">
        <StatCard
          label="Drafts awaiting review"
          value={data.counts.drafts_awaiting_review}
          hint="Open review queue →"
          icon="◇"
          tone="info"
          href={draftCardHref}
        />
        <StatCard
          label="Materials needing attention"
          value={data.counts.materials_needing_attention}
          hint={data.counts.materials_needing_attention ? "Check processing →" : "All materials are ready →"}
          icon="▤"
          tone={data.counts.materials_needing_attention ? "bad" : "good"}
          href={data.queue_hrefs.materials}
        />
        <StatCard
          label="Upcoming activities"
          value={data.counts.upcoming_activities}
          hint="See scheduled activities →"
          icon="▦"
          tone="info"
          href={data.queue_hrefs.activities}
        />
        <StatCard
          label="Class progress"
          value={`${data.counts.class_progress_percent}%`}
          hint="Average completion →"
          icon="↗"
          tone="good"
          href={data.queue_hrefs.performance}
        />
      </div>

      <div className="ws-columns">
        <section className="ws-panel" aria-labelledby="attention-title">
          <div className="ws-panel-head">
            <div>
              <p className="eyebrow-label">ACTION QUEUE</p>
              <h2 id="attention-title">Needs your attention</h2>
            </div>
            <Link className="ws-text-link" href={draftCardHref}>
              View review queue →
            </Link>
          </div>
          {queue.length === 0 ? (
            <EmptyState
              title="No drafts need review"
              tone="success"
              action={
                <div className="ws-inline-actions">
                  <Link className="button button-outline small" href={`/faculty/materials?course=${data.course.id}`}>
                    Upload material
                  </Link>
                  <Link className="button button-primary small" href={`/faculty/activities?course=${data.course.id}&create=1`}>
                    Create activity
                  </Link>
                </div>
              }
            >
              Nothing is waiting in {data.course.title}. Upload a source PDF or create an activity to prepare the next
              lesson.
            </EmptyState>
          ) : (
            <ul className="ws-list">
              {queue.map((item) => (
                <li className="ws-row" key={`${item.kind}-${item.id}`}>
                  <div className="ws-row-main">
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                    <span className="ws-row-meta">Updated {formatDateTime(item.updated_at)}</span>
                  </div>
                  <div className="ws-row-actions">
                    <StatusChip state={item.status} tone={item.severity} />
                    <Link className="button button-outline small" href={item.href}>
                      {ACTION_LABEL[item.kind] || "Open"}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="ws-stack">
          <section className="ws-panel" aria-labelledby="snapshot-title">
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">CLASS</p>
                <h2 id="snapshot-title">At a glance</h2>
              </div>
              <Link className="ws-text-link" href={data.queue_hrefs.performance}>
                Open performance →
              </Link>
            </div>
            {data.class_snapshot.active_learners === 0 ? (
              <EmptyState title="No students enrolled yet">
                An administrator enrolls students in this course. Performance appears once enrollment exists.
              </EmptyState>
            ) : (
              <>
                <div className="ws-soft">
                  <strong>{data.class_snapshot.active_learners} active learners</strong>
                  <p>
                    {data.class_snapshot.average_completion_percent}% average completion across{" "}
                    {data.class_snapshot.published_activities} published{" "}
                    {data.class_snapshot.published_activities === 1 ? "activity" : "activities"}.
                  </p>
                </div>
                <div className="ws-soft">
                  <strong>
                    {data.class_snapshot.average_score === null
                      ? "No graded attempts yet"
                      : `${data.class_snapshot.average_score}% average on the latest activity`}
                  </strong>
                  <p>
                    {data.class_snapshot.need_follow_up} student
                    {data.class_snapshot.need_follow_up === 1 ? " has" : "s have"} not started any activity.
                  </p>
                </div>
              </>
            )}
          </section>

          <section className="ws-panel" aria-labelledby="upcoming-title">
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">SCHEDULE</p>
                <h2 id="upcoming-title">Upcoming activities</h2>
              </div>
            </div>
            {data.upcoming.length === 0 ? (
              <p className="ws-muted">Nothing opens in the next 14 days.</p>
            ) : (
              <ul className="ws-compact-list">
                {data.upcoming.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href}>{item.title}</Link>
                    <span>
                      {item.state === "scheduled" ? "Opens" : "Open"} {formatDateTime(item.opens_at)}
                      {item.closes_at ? ` · closes ${formatDateTime(item.closes_at)}` : ""} (Asia/Manila)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ws-panel" aria-labelledby="recent-title">
            <div className="ws-panel-head">
              <div>
                <p className="eyebrow-label">AUDIT</p>
                <h2 id="recent-title">Recent changes</h2>
              </div>
            </div>
            {data.recent_changes.length === 0 ? (
              <p className="ws-muted">No recorded changes in this course yet.</p>
            ) : (
              <ul className="ws-compact-list">
                {data.recent_changes.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.summary}</strong>
                    <span>
                      {entry.actor} · {formatDateTime(entry.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {activeCourse?.description ? <p className="ws-muted">{activeCourse.description}</p> : null}
          </section>
        </div>
      </div>

      {data.counts.materials_needing_attention > 0 ? (
        <Notice tone="warning">
          {data.counts.materials_needing_attention} source{" "}
          {data.counts.materials_needing_attention === 1 ? "material needs" : "materials need"} attention before new drafts
          can cite it.{" "}
          <Link href={data.queue_hrefs.materials}>Review materials →</Link>
        </Notice>
      ) : null}

      <p className="ws-footnote">Dates use your local timezone (Asia/Manila). Counts refresh after each action.</p>
    </>
  );
}

export default function Page() {
  return (
    <WorkspaceSuspense label="teaching dashboard">
      <FacultyDashboardPage />
    </WorkspaceSuspense>
  );
}
