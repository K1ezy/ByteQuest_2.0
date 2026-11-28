"use client";

import { activeSentence, classPassedSentence, notStartedSentence, weekChange } from "@/lib/takeaway";
import { MetricCard } from "@/components/insights/metric-card";
import { metrics } from "@/lib/insight-metrics";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { MeasureDefinitions } from "@/components/insights/ui";
import { AnnounceButton } from "@/components/instructor/course-announcements";
import {
  DataRow, InlineEmpty, InlineError, InstructorIcon, PageHeader, RowSkeleton, Section, StatSkeleton, StatusBadge,
} from "@/components/instructor/course-ui";
import { ActivityRow } from "@/components/instructor/activity-identity";
import { activityEditorHref } from "@/lib/instructor-activity";
import type { GamificationInsightsData } from "@/components/instructor/gamification-insights";
import { useToast } from "@/components/toast";
import { useApi, useNow } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { getErrorMessage } from "@/lib/api";
import { caughtUp, dashboardHeading, recentActivity, sortAttention, upcomingActivities } from "@/lib/instructor-dashboard";
import { queryString, retryMaterial, type ActivityList, type FacultyDashboard, type MaterialList, type QueueItem } from "@/lib/workspace";

function AttentionRow({ item, retry, busy }: { item: QueueItem; retry?: () => void; busy?: boolean }) {
  if (item.kind === "material") {
    const failed = item.status === "Failed";
    return <DataRow title={item.title} href={item.href}
      status={<StatusBadge tone={failed ? "danger" : "warning"}>{failed ? "Failed" : "Fix file"}</StatusBadge>}
      description={failed ? "Search index couldn't be built. Your PDF is safe." : "No searchable text. Upload a text-based PDF."}
      action={failed && retry ? <button type="button" className="ic-button" disabled={busy} onClick={retry}>{busy ? "Retrying…" : "Retry"}</button>
        : <Link className="ic-button" href={failed ? item.href : item.href + "&replace=1"}>{failed ? "Open" : "Replace"}</Link>} />;
  }
  return <DataRow title={item.title} href={item.href}
    status={<StatusBadge>{item.kind === "activity" ? "Soon" : item.status}</StatusBadge>}
    description={item.kind === "activity" ? "This activity is scheduled to open soon." : item.detail}
    action={<Link className="ic-button" href={item.href}>Open</Link>} />;
}

function Dashboard({ courseId }: { courseId: string }) {
  const { activeCourse, courseHref, refreshCourses } = useWorkspace();
  const showAll = useSearchParams().get("attention") === "all";
  const now = useNow();
  const toast = useToast();
  const [retryId, setRetryId] = useState<string | null>(null);
  const scope = { course_id: courseId };
  const overview = useApi<FacultyDashboard>("/faculty/dashboard" + queryString(scope), true);
  const materials = useApi<MaterialList>("/faculty/materials" + queryString({ ...scope, status: "attention" }), true);
  const insight = useApi<GamificationInsightsData>("/faculty/gamification-insights" + queryString(scope), true);
  const activities = useApi<ActivityList>("/faculty/activities" + queryString(scope), true);

  const extras = overview.data?.action_queue.filter((item) => item.kind !== "material" && item.kind !== "draft") ?? [];
  const materialItems: QueueItem[] = (materials.data?.items ?? []).map((item) => ({
    kind: "material", id: item.document_id, title: item.title, detail: item.processing_error ?? "",
    status: item.state === "failed" ? "Failed" : "Needs review", severity: "bad", course: activeCourse, updated_at: item.created_at,
    href: courseHref("/instructor/materials" + queryString({ material: item.document_id })),
  }));
  const activityById = new Map((activities.data?.items ?? []).map((item) => [item.activity_id, item]));
  const draftItems: QueueItem[] = (activities.data?.items ?? []).filter((item) => item.state === "draft").map((item) => ({
    kind: "draft", id: item.activity_id, title: item.title || item.topic_concept,
    detail: "", status: "Draft", severity: "wait", course: item.course, updated_at: item.created_at,
    href: activityEditorHref(item.activity_id, courseId),
  }));
  const queue = sortAttention([...materialItems, ...draftItems, ...extras]);
  const canRetry = new Set(materials.data?.items.filter((item) => item.can_retry).map((item) => item.document_id));
  const haveQueue = Boolean(overview.data && materials.data && activities.data);
  const queueError = overview.error || materials.error || activities.error;
  const queueTotal = haveQueue ? (materials.data?.total ?? 0) + draftItems.length + extras.length : null;
  const { title, subtitle } = dashboardHeading(now, queueTotal);
  const upcoming = upcomingActivities(activities.data?.items ?? [], now);
  const inactive = overview.data?.class_snapshot.inactive_7d ?? 0;
  const notStarted = overview.data?.class_snapshot.need_follow_up ?? 0;
  const stuckTopics = (insight.data?.topics ?? []).filter((row) => row.students_stuck > 0)
    .sort((a, b) => b.students_stuck - a.students_stuck || a.topic.localeCompare(b.topic)).slice(0, notStarted ? 3 : 4);

  function loadQueue() {
    overview.reload();
    activities.reload();
    materials.reload();
  }

  async function retry(id: string) {
    if (retryId) return;
    setRetryId(id);
    try {
      const result = await retryMaterial("faculty", id);
      toast.show(result.message, result.material.state === "ready" ? "success" : "error");
      loadQueue();
      await refreshCourses();
    } catch (error) {
      toast.show(getErrorMessage(error), "error");
    } finally {
      setRetryId(null);
    }
  }

  return <>
    <PageHeader title={title} subtitle={subtitle} actions={
      <AnnounceButton courseId={courseId} manageHref={courseHref("/instructor/announcements")} />
    } />
    {overview.error ? <InlineError onRetry={overview.reload} /> : overview.data ? (
      <div className="ws-stat-grid instructor-summary">
        <MetricCard metric="not_started" value={notStarted}
          sentence={notStartedSentence(notStarted, overview.data.counts.active_learners)}
          change={weekChange(notStarted, overview.data.class_snapshot.last_week?.need_follow_up)}>
          {notStarted ? <Link className="insight-practice" href={courseHref("/instructor/performance?notStarted=1#instructor-roster")}>Show them →</Link> : null}
        </MetricCard>
        <MetricCard metric="active_7d" value={overview.data.class_snapshot.active_7d}
          sentence={activeSentence(overview.data.class_snapshot.active_7d, overview.data.counts.active_learners)}
          change={weekChange(overview.data.class_snapshot.active_7d, overview.data.class_snapshot.last_week?.active_7d)}>
          {inactive ? <Link className="insight-practice" href={courseHref("/instructor/performance?inactive=1#instructor-roster")}>Show the {inactive} inactive →</Link> : null}
        </MetricCard>
        <MetricCard metric="activities_passed" value={overview.data.counts.class_progress_percent + "%"}
          sentence={classPassedSentence(overview.data.counts.class_progress_percent, overview.data.class_snapshot.published_activities)} />
        <MetricCard metric="submissions_7d" value={overview.data.class_snapshot.attempts_7d}
          sentence={`Learners submitted ${overview.data.class_snapshot.attempts_7d} practice ${overview.data.class_snapshot.attempts_7d === 1 ? "attempt" : "attempts"} in the last 7 days.`} />
      </div>
    ) : <StatSkeleton />}
    {overview.data ? <MeasureDefinitions names={["active_7d", "activities_passed", "stuck"]} /> : null}

    <div className="ic-columns">
      <Section title="Needs your attention" id="instructor-attention" className="ic-area-attention"
        action={queueTotal && queueTotal > 5 ? <Link href={courseHref(showAll ? "/instructor#instructor-attention" : "/instructor?attention=all#instructor-attention")}>{showAll ? "Show fewer" : "View all"}</Link> : null}>
        {queueError ? <InlineError onRetry={loadQueue} /> : !haveQueue ? <RowSkeleton /> : queue.length ? (
          <ul className="ic-list">{(showAll ? queue : queue.slice(0, 5)).map((item) => {
            const activity = item.kind === "material" ? undefined : activityById.get(item.id);
            return activity ? <ActivityRow key={item.id} activity={activity} /> : <AttentionRow key={item.kind + "-" + item.id} item={item}
              retry={canRetry.has(item.id) ? () => void retry(item.id) : undefined} busy={retryId !== null} />;
          })}</ul>
        ) : <InlineEmpty>{caughtUp}.</InlineEmpty>}
      </Section>
      <aside className="ic-area-rail">
        <Section title="Students to check" id="instructor-students">
          {insight.error || overview.error ? <InlineError onRetry={() => { insight.reload(); overview.reload(); }} /> : !insight.data || !overview.data ? <RowSkeleton /> : stuckTopics.length || notStarted || inactive ? (
            <ul className="ic-list">
              {stuckTopics.map((row) => {
                const evidence = [...row.categories].filter((item) => item.failed_tries > 0).sort((a, b) => b.failed_tries - a.failed_tries)[0];
                const description = evidence ? evidence.failed_tries + " " + evidence.label.toLowerCase() + (evidence.failed_tries === 1 ? " error, " : " errors, ") + (evidence.recoveries || "none") + " recovered" : "Attempts recorded without a pass";
                return <DataRow key={row.topic} title={row.students_stuck + " stuck on " + row.topic}
                  href={courseHref("/instructor/gamification" + queryString({ topic: row.topic }) + "#instructor-debugging")}
                  description={description} lead={<span className="ic-warning-icon"><InstructorIcon name="warning" /></span>} chevron />;
              })}
              {inactive ? <DataRow title={inactive + " inactive for 7+ days"} href={courseHref("/instructor/performance?inactive=1#instructor-roster")} description={metrics.inactive_7d.definition} chevron/> : null}
              {notStarted ? <DataRow title={notStarted + (notStarted === 1 ? " hasn't started" : " haven't started")}
                href={courseHref("/instructor/performance?notStarted=1#instructor-roster")}
                description="No attempts on any activity" lead={<InstructorIcon name="pause" />} chevron /> : null}
            </ul>
          ) : <InlineEmpty>No one needs a check-in right now.</InlineEmpty>}
        </Section>
        <Section title="Coming up" id="instructor-upcoming">
          {activities.error ? <InlineError onRetry={activities.reload} /> : !activities.data ? <RowSkeleton /> : upcoming.length ? (
            <ul className="ic-list">{upcoming.map((item) => {
              const activity = activityById.get(item.id);
              return activity ? <ActivityRow key={item.id} activity={activity} /> : null;
            })}</ul>
          ) : <InlineEmpty>Nothing opens in the next 14 days. <Link href={courseHref("/instructor/activities")}>View activities</Link></InlineEmpty>}
        </Section>
      </aside>
      <Section title="Recent activity" id="instructor-recent" className="ic-area-recent">
        {overview.error ? <InlineError onRetry={overview.reload} /> : !overview.data ? <RowSkeleton compact /> : overview.data.recent_changes.length ? (
          <ul className="ic-list">{overview.data.recent_changes.slice(0, 5).map((entry) => {
            const { actor, verb, item, day } = recentActivity(entry);
            return <li className="ic-feed" key={entry.id}>{actor} {verb} <b>{item}</b>{day ? " · " + day : ""}</li>;
          })}</ul>
        ) : <InlineEmpty>No recent activity.</InlineEmpty>}
      </Section>
    </div>
  </>;
}

export default function Page() {
  const { courseId } = useWorkspace();
  return courseId ? <Dashboard key={courseId} courseId={courseId} /> : <InlineEmpty>Choose an assigned course.</InlineEmpty>;
}
