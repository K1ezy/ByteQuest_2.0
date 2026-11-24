import Link from "next/link";
import type { ReactNode } from "react";
import { workshopLanguages } from "@/components/workshops/workshop-ui";
import { formatManilaDateTime } from "@/lib/activity-date";
import { activityEditorHref, instructorActivityState, publicationChecks } from "@/lib/instructor-activity";
import { withCourse } from "@/lib/navigation";
import type { ActivityListItem } from "@/lib/workspace";

type Identity = {
  title: string | null;
  topic_concept: string;
  course: { title: string } | null;
  state: string;
  publication_issues?: string[];
  draft_state?: string;
  exam_only?: boolean;
  opens_at: string | null;
};

const labels: Record<string, string> = {
  draft: "Draft", ready: "Ready", scheduled: "Scheduled", open: "Open", closed: "Closed", archived: "Archived",
};

export function ActivityIdentity({ activity, page = false, feedback }: {
  activity: Identity; page?: boolean; feedback?: ReactNode;
}) {
  const Heading = page ? "h1" : "h3";
  const state = instructorActivityState(activity);
  const problem = activity.publication_issues?.[0];
  const readiness = state === "ready" ? (activity.exam_only ? "Available for exams" : "Review the student preview")
    : state === "draft" && (activity.draft_state === "rejected" ? "Changes requested" : problem && publicationChecks[problem]?.action);
  return (
    <div className={`ic-activity-identity${page ? " is-page" : ""}`}>
      <Heading>{activity.title || activity.topic_concept}</Heading>
      <div className="ic-activity-meta">
        {activity.course?.title ? <span>{activity.course.title}</span> : null}
        <span className="ic-activity-state" data-state={state}>{labels[state] || state}</span>
        {state === "scheduled" && activity.opens_at ? (
          <time dateTime={activity.opens_at}>{formatManilaDateTime(activity.opens_at)} Manila time</time>
        ) : null}
        {activity.exam_only ? <span className="ic-activity-tag">Exam only</span> : null}
        {readiness ? <span>{readiness}</span> : null}
        {feedback}
      </div>
    </div>
  );
}

export function ActivityRow({ activity, highlighted = false, published = false, menu }: {
  activity: ActivityListItem; highlighted?: boolean; published?: boolean; menu?: ReactNode;
}) {
  const { health } = activity;
  const draft = activity.state === "draft";
  const action = draft ? (highlighted ? "Continue" : "Continue editing") : "Open activity";
  return (
    <li id={`activity-${activity.activity_id}`} className={`ic-row ic-activity-row${highlighted ? " is-highlighted" : ""}`}
      tabIndex={highlighted ? -1 : undefined}>
      <div className="ic-row-main">
        <ActivityIdentity activity={activity} />
        <p className="ic-activity-row-detail">
          {activity.activity_type === "quiz" ? "Quiz" : "Coding challenge"}
          {activity.state === "open" && health ? (
            <>
              { ` · ${health.passed} of ${health.attempted + health.not_started} passed · ` }
              <Link href={withCourse(`/instructor/performance?activity=${encodeURIComponent(activity.activity_id)}&stuck=1`, activity.course?.id ?? null)}>
                {health.stuck} stuck
              </Link>
              { ` · ${health.not_started} not started` }
            </>
          ) : activity.attempt_count > 0 ? ` · ${activity.attempt_count} attempts` : ""}
          {activity.state === "open" && activity.closes_at ? ` · Closes ${formatManilaDateTime(activity.closes_at)}` : ""}
        </p>
        {published && highlighted && activity.state === "open" ? (
          <p className="ic-activity-outcome" role="status">Students in {activity.course?.title ?? "this course"}{activity.language ? ` on the ${workshopLanguages[activity.language]} track` : ""} can open it now.</p>
        ) : null}
        {published && highlighted && activity.state === "scheduled" ? (
          <p className="ic-activity-outcome" role="status">The activity will open to eligible students at the scheduled time.</p>
        ) : null}
        {published && highlighted && activity.state === "closed" ? (
          <p className="ic-activity-outcome" role="status">Published with submissions closed.</p>
        ) : null}
      </div>
      <div className="ic-row-actions">
        <Link className={`ic-button${highlighted ? " ic-primary" : ""}`} href={activityEditorHref(activity.activity_id, activity.course?.id ?? null)}
          aria-label={`${action} ${activity.title || activity.topic_concept}`}>{action}</Link>
        {menu}
      </div>
    </li>
  );
}
