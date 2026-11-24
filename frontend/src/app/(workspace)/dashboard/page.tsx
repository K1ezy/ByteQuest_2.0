"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ApiError, apiRequest, getErrorMessage } from "@/lib/api";
import { useShellProfile } from "@/components/app-shell";
import { questHref } from "@/components/quest-card";
import { StudentAnnouncements } from "@/components/student-announcements";
import { useApi, useNow } from "@/components/workspace/ui";
import { timeGreeting } from "@/lib/greeting";
import { studentAnnouncementsPath, type StudentAnnouncement } from "@/lib/workspace";
import type { Profile } from "@/lib/types";
import { ResearchConsentCard } from "@/components/research-consent";

interface Dashboard {
  recommendation: { rationale: string; recommended_action: string };
  next_activity: { id: string; title: string; kind: "quiz" | "challenge" } | null;
  pending_job_id: string | null;
  due_exam: { id: string; title: string; closes_at: string } | null;
  notices: { id: string; subject: string; body: string }[];
}

const localTime = (value: string) => new Date(value).toLocaleString("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
});
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function closesIn(value: string, now: Date) {
  const minutes = Math.round((new Date(value).getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "Closing now";
  if (minutes < 60) return `Closes ${relative.format(minutes, "minute")}`;
  if (minutes < 48 * 60) return `Closes ${relative.format(Math.round(minutes / 60), "hour")}`;
  return `Closes ${relative.format(Math.round(minutes / 1440), "day")}`;
}
const kindLabel = (kind: "quiz" | "challenge") => kind === "quiz" ? "Quiz" : "Challenge";
const vars = (values: Record<string, string | number>) => values as CSSProperties;

export default function DashboardPage() {
  const profile = useShellProfile();
  return <DashboardContent key={profile.id} profile={profile} />;
}

function DashboardContent({ profile }: { profile: Profile }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const now = useNow();
  const { data: announcements, reload: reloadAnnouncements } = useApi<{ items: StudentAnnouncement[] }>(studentAnnouncementsPath);
  const [errorStatus, setErrorStatus] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (initial = false) => {
    if (!initial) {
      setRefreshing(true);
      reloadAnnouncements();
    }
    setError("");
    try {
      setData(await apiRequest<Dashboard>("/pilot/dashboard"));
    } catch (cause) {
      setErrorStatus(cause instanceof ApiError ? cause.status : 0);
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [reloadAnnouncements]);

  useEffect(() => {
    // Initial load synchronizes this client page with the authenticated API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(true);
  }, [load]);

  useEffect(() => {
    const handleFocus = () => { void load(); };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [load]);

  const nextActivity = data?.next_activity;
  const needsLanguage = !profile.enrolled_language;
  const nextHref = nextActivity ? questHref({ id: nextActivity.id, activity_type: nextActivity.kind }) : needsLanguage ? "/workshops" : "/quests";
  const nextTitle = needsLanguage ? "Choose your programming language"
    : data?.recommendation.recommended_action === "no_published_activities" ? "Your quests are coming soon" : "No next quest available";

  const announcementList = <StudentAnnouncements items={announcements?.items ?? []} now={now} onEmpty={() => heading.current?.focus()} />;

  return (
    <div className="page-shell pilot-dashboard dashboard-hub">
      {error && data && <p className="notice" role="status">The local ByteQuest service is unavailable. Showing your last loaded dashboard.</p>}

      <header className="dashboard-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>{timeGreeting(profile.display_name || (profile.handle_chosen === false ? "" : profile.username), now)}</h1>
          <p className="pilot-lead">Find your next quest and check for class updates.</p>
        </div>
        <div className="pilot-actions">
          <Link className="button button-outline small" href="/profile?tab=activity">View my progress</Link>
          {data && <button className="button button-outline small dashboard-refresh" type="button" onClick={() => void load()}
            disabled={refreshing} aria-busy={refreshing} data-tooltip="Check for new assignments and class updates.">
            <span className="dashboard-refresh-icon" aria-hidden="true">↻</span>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>}
        </div>
      </header>

      {!data && announcementList}
      {loading && <div className="dashboard-skeleton" role="status" aria-label="Loading your dashboard">
        <div className="ws-skeleton dashboard-skeleton-hero" />
      </div>}
      {error && <div className="notice error" role="alert">{error}{" "}
        {errorStatus === 401 ? <Link href="/onboarding?mode=signin&redirect=/dashboard">Sign in again</Link>
          : errorStatus === 403 ? <Link href="/profile">Check your account</Link>
          : <button type="button" className="button button-outline" onClick={() => void load()}>Retry</button>}
      </div>}

      {data?.due_exam && (
        <section className="dashboard-exam dashboard-reveal" aria-labelledby="due-exam-priority-title">
          <span className="dashboard-exam-icon" aria-hidden="true">✎</span>
          <div className="dashboard-exam-copy">
            <span className="dashboard-kicker">Assigned exam</span>
            <h2 id="due-exam-priority-title">{data.due_exam.title}</h2>
            <p><strong>{closesIn(data.due_exam.closes_at, now)}</strong> · {localTime(data.due_exam.closes_at)} (Asia/Manila)</p>
          </div>
          <Link className="button button-primary" href={`/exams/${data.due_exam.id}`} data-tooltip="View the exam instructions or return to your attempt.">Open exam <span aria-hidden="true">→</span></Link>
        </section>
      )}

      {data?.pending_job_id && (
        <section className="pilot-card dashboard-pending dashboard-reveal" aria-labelledby="pending-title">
          <p className="dashboard-kicker"><span className="dashboard-live-dot" aria-hidden="true" />Submission in progress</p>
          <h2 id="pending-title">Grading in progress</h2>
          <p>Check the result when grading finishes.</p>
          <Link className="button button-outline small" href={`/submissions/${data.pending_job_id}`}>View submission status</Link>
        </section>
      )}

      {data && (
        <>
          <section className="pilot-card pilot-priority dashboard-next dashboard-reveal" style={vars({ "--reveal-step": 1 })} aria-labelledby="continue-title">
            <div className="dashboard-next-meta">
              <p className="eyebrow-label">Recommended next</p>
              {nextActivity && <span className="dashboard-chip">{kindLabel(nextActivity.kind)}</span>}
            </div>
            <h2 id="continue-title">{nextActivity?.title ?? nextTitle}</h2>
            <p>{needsLanguage ? "Join a workshop to choose a language and start practicing." : data.recommendation.rationale}</p>
            <div className="pilot-actions">
              <Link className={`button ${data.due_exam ? "button-outline" : "button-primary"} dashboard-next-cta`} href={nextHref}
                data-tooltip={nextActivity ? "Open the activity recommended for your current progress." : undefined}>
                {nextActivity ? "Continue quest" : needsLanguage ? "Go to Workshops" : "Explore quest map"} <span className="dashboard-arrow" aria-hidden="true">→</span>
              </Link>
              {nextActivity && <Link className="button button-quiet" href="/quests">Full quest map</Link>}
              <Link className="button button-quiet" href="/profile?tab=mastery">Review concepts</Link>
            </div>
          </section>

          <ResearchConsentCard />
          {announcementList}
          {data.notices?.length > 0 && (
            <section className="dashboard-notices dashboard-reveal" aria-labelledby="notices-title">
              <h2 id="notices-title" className="dashboard-kicker">Notices</h2>
              <ul>
                {data.notices.map((notice) => <li key={notice.id}>
                  <strong>{notice.subject}</strong>
                  <p>{notice.body}</p>
                </li>)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
