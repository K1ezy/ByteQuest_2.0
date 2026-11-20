"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ApiError, apiRequest, getErrorMessage } from "@/lib/api";
import { useShellProfile } from "@/components/app-shell";
import { MemoryCheck } from "@/components/memory-check";
import { ProgressRecap } from "@/components/progress-recap";
import { StudentAnnouncements } from "@/components/student-announcements";
import { useApi, useNow } from "@/components/workspace/ui";
import { timeGreeting } from "@/lib/greeting";
import { studentAnnouncementsPath, type StudentAnnouncement } from "@/lib/workspace";
import type { Profile } from "@/lib/types";

interface Dashboard {
  recommendation: { rationale: string; target_activity_id: string | null };
  next_activity: { id: string; title: string; kind: "quiz" | "challenge" } | null;
  completed: number;
  total: number;
  xp: number;
  level: number;
  pending_job_id: string | null;
  due_exam: { id: string; title: string; closes_at: string } | null;
  notices: { id: string; subject: string; body: string }[];
}

interface Progress {
  total_attempts: number;
  attempts: {
    attempt_id: string;
    activity_id: string;
    title: string | null;
    activity_type: "quiz" | "challenge";
    score_percentage: number;
    is_successful: boolean;
    created_at: string;
  }[];
  badges: { code: string | null; name: string; description: string }[];
}

// Mirrors XP_PER_LEVEL in backend/app/services/gamification/progression.py.
const XP_PER_LEVEL = 250;
const RECENT_LIMIT = 5;

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
const activityHref = (kind: "quiz" | "challenge", id: string) => `/${kind === "quiz" ? "quiz" : "arena"}/${id}`;
const vars = (values: Record<string, string | number>) => values as CSSProperties;

export default function DashboardPage() {
  const profile = useShellProfile();
  return <DashboardContent key={profile.id} profile={profile} />;
}

function DashboardContent({ profile }: { profile: Profile }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const now = useNow();
  const { data: announcements, reload: reloadAnnouncements } = useApi<{ items: StudentAnnouncement[] }>(studentAnnouncementsPath);
  const [errorStatus, setErrorStatus] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllAttempts, setShowAllAttempts] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (initial = false) => {
    if (!initial) {
      setRefreshing(true);
      reloadAnnouncements();
    }
    setError("");
    try {
      const [dashboardResult, progressResult] = await Promise.allSettled([
        apiRequest<Dashboard>("/pilot/dashboard"),
        apiRequest<Progress>("/quests/progress?limit=20"),
      ]);
      if (dashboardResult.status === "rejected") throw dashboardResult.reason;
      setData(dashboardResult.value);
      if (progressResult.status === "fulfilled") setProgress(progressResult.value);
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

  const track = profile.enrolled_language.toUpperCase();
  const nextHref = data?.next_activity ? activityHref(data.next_activity.kind, data.next_activity.id) : "/quests";
  const completion = data && data.total > 0 ? Math.min(100, Math.round(data.completed / data.total * 100)) : 0;
  const remaining = data ? Math.max(0, data.total - data.completed) : 0;
  const xpIntoLevel = data ? Math.min(XP_PER_LEVEL, Math.max(0, data.xp - (data.level - 1) * XP_PER_LEVEL)) : 0;
  const attempts = progress?.attempts ?? [];
  const visibleAttempts = showAllAttempts ? attempts : attempts.slice(0, RECENT_LIMIT);
  const lead = !data ? "Pick up your next quest and review your progress."
    : data.total === 0 ? `Your instructor hasn't published activities for the ${track} track yet.`
    : remaining === 0 ? `You've completed every published activity on the ${track} track.`
    : `${remaining} ${remaining === 1 ? "activity" : "activities"} left to finish the ${track} track.`;

  return (
    <div className="page-shell pilot-dashboard dashboard-hub">
      {error && data && <p className="notice" role="status">The local ByteQuest service is unavailable. Showing your last loaded progress.</p>}

      <header className="dashboard-heading">
        <div>
          <p className="eyebrow-label">Your learning journey</p>
          <h1 ref={heading} tabIndex={-1}>{timeGreeting(profile.display_name || (profile.handle_chosen === false ? "" : profile.username), now)}</h1>
          <p className="pilot-lead">{lead}</p>
        </div>
        {data && <button className="button button-outline small dashboard-refresh" type="button" onClick={() => void load()}
          disabled={refreshing} aria-busy={refreshing} data-tooltip="Check for new grades, completed quests, and rewards.">
          <span className="dashboard-refresh-icon" aria-hidden="true">↻</span>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>}
      </header>

      <StudentAnnouncements items={announcements?.items ?? []} now={now} onEmpty={() => heading.current?.focus()} />

      {loading && <div className="pilot-dashboard-grid dashboard-skeleton" role="status" aria-label="Loading your dashboard">
        <div className="dashboard-main-column">
          <div className="ws-skeleton dashboard-skeleton-hero" />
          <div className="ws-skeleton dashboard-skeleton-list" />
        </div>
        <div className="dashboard-side-column">
          <div className="ws-skeleton dashboard-skeleton-side" />
          <div className="ws-skeleton dashboard-skeleton-side" />
        </div>
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

      {data && data.notices?.length > 0 && (
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

      {data && (
        <div className="pilot-dashboard-grid">
          <div className="dashboard-main-column">
            {profile.role === "student" ? <MemoryCheck userId={profile.id} /> : null}
            <section className="pilot-card pilot-priority dashboard-next dashboard-reveal" style={vars({ "--reveal-step": 1 })} aria-labelledby="continue-title">
              <div className="dashboard-next-meta">
                <p className="eyebrow-label">Recommended next</p>
                {data.next_activity && <span className="dashboard-chip">{kindLabel(data.next_activity.kind)}</span>}
              </div>
              <h2 id="continue-title">{data.next_activity?.title || (data.total === 0 ? "Your quests are coming soon" : remaining === 0 ? "Your track is complete" : "No next quest available")}</h2>
              <p>{data.recommendation.rationale}</p>
              <div className="pilot-actions">
                <Link className={`button ${data.due_exam ? "button-outline" : "button-primary"} dashboard-next-cta`} href={nextHref}
                  data-tooltip={data.next_activity ? "Open the activity recommended for your current progress." : undefined}>
                  {data.next_activity ? "Continue quest" : "Explore quest map"} <span className="dashboard-arrow" aria-hidden="true">→</span>
                </Link>
                {data.next_activity && <Link className="button button-quiet" href="/quests">Full quest map</Link>}
              </div>
            </section>

            {data.pending_job_id && (
              <section className="pilot-card dashboard-pending dashboard-reveal" aria-labelledby="pending-title">
                <p className="dashboard-kicker"><span className="dashboard-live-dot" aria-hidden="true" />Submission in progress</p>
                <h2 id="pending-title">Grading in progress</h2>
                <p>Check the result when grading finishes.</p>
                <Link href={`/submissions/${data.pending_job_id}`}>View submission status</Link>
              </section>
            )}

            <section className="pilot-card dashboard-history dashboard-reveal" style={vars({ "--reveal-step": 2 })} aria-labelledby="history-title">
              <div className="dashboard-section-heading">
                <h2 id="history-title">Recent attempts</h2>
                <span>{progress ? `${progress.total_attempts} total` : "Unavailable"}</span>
              </div>
              {attempts.length ? <>
                <ul className="dashboard-attempt-list" id="dashboard-attempts">
                  {visibleAttempts.map((attempt) => {
                    const score = Math.round(attempt.score_percentage);
                    return <li key={attempt.attempt_id}>
                      <Link className="dashboard-attempt" href={activityHref(attempt.activity_type, attempt.activity_id)}>
                        <span className={`dashboard-attempt-icon ${attempt.activity_type}`} aria-hidden="true">{attempt.activity_type === "quiz" ? "?" : "</>"}</span>
                        <span className="dashboard-attempt-text">
                          <strong>{attempt.title || (attempt.activity_type === "quiz" ? "Concept quiz" : "Code challenge")}</strong>
                          <span>{kindLabel(attempt.activity_type)} · {localTime(attempt.created_at)}</span>
                        </span>
                        <span className={attempt.is_successful ? "dashboard-result passed" : "dashboard-result"}>
                          <span>{attempt.is_successful ? "Passed" : "Keep practicing"} · {score}%</span>
                          <span className="dashboard-score-bar" style={vars({ "--score": `${score}%` })} aria-hidden="true" />
                        </span>
                      </Link>
                    </li>;
                  })}
                </ul>
                {attempts.length > RECENT_LIMIT && <button type="button" className="button button-quiet small dashboard-more"
                  aria-expanded={showAllAttempts} aria-controls="dashboard-attempts" onClick={() => setShowAllAttempts((open) => !open)}>
                  {showAllAttempts ? "Show fewer" : `Show all ${attempts.length}`}
                </button>}
              </> : <div className="dashboard-empty">
                <p>{progress ? "No attempts yet. Start a quest to see your work here." : "Your attempt history is currently unavailable."}</p>
                {progress && <Link className="dashboard-text-link" href="/quests">Browse quests <span aria-hidden="true">→</span></Link>}
              </div>}
            </section>
          </div>

          <aside className="dashboard-side-column" aria-label="Your progress and rewards">
            <section className="pilot-card dashboard-progress dashboard-reveal" style={vars({ "--reveal-step": 1 })} aria-labelledby="progress-title">
              <p className="eyebrow-label">Your progress</p>
              <div className="dashboard-progress-body">
                <div className="dashboard-ring" role="progressbar" aria-label="Quest completion" aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={completion} style={vars({ "--pct": completion })}>
                  <span>{completion}%</span>
                </div>
                <div>
                  <h2 id="progress-title">{data.completed} of {data.total} done</h2>
                  <p className="dashboard-muted">Published activities on the {track} track</p>
                </div>
              </div>
              {data.total === 0 && <p className="dashboard-muted">Your instructor has not published activities for this track yet.</p>}
              <Link className="dashboard-text-link" href="/onboarding?mode=change_track" data-tooltip="Choose which programming language to practice.">Change learning track</Link>
            </section>

            {profile.role === "student" ? <ProgressRecap userId={profile.id} /> : null}

            <section className="pilot-card dashboard-rewards dashboard-reveal" style={vars({ "--reveal-step": 2 })} aria-labelledby="rewards-title">
              <p className="eyebrow-label">Rewards</p>
              <div className="dashboard-level">
                <span className="dashboard-level-badge" aria-hidden="true">{data.level}</span>
                <div>
                  <h2 id="rewards-title">Level {data.level}</h2>
                  <p className="dashboard-xp">✦ {data.xp} XP</p>
                </div>
              </div>
              <div className="dashboard-meter" role="progressbar" aria-label={`XP toward level ${data.level + 1}`}
                aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-valuenow={xpIntoLevel}>
                <span style={vars({ "--fill": `${xpIntoLevel / XP_PER_LEVEL * 100}%` })} />
              </div>
              <p className="dashboard-muted">{XP_PER_LEVEL - xpIntoLevel} XP to Level {data.level + 1}</p>

              <h3 className="dashboard-subheading">{progress ? `Badges · ${progress.badges.length}` : "Badges"}</h3>
              {!progress ? <p className="dashboard-muted">Badge details unavailable.</p>
                : progress.badges.length ? <ul className="dashboard-badge-list">
                  {progress.badges.map((badge) => <li key={badge.code || badge.name}>
                    <span className="dashboard-badge-icon" aria-hidden="true">✦</span>
                    <span><strong>{badge.name}</strong>{badge.description && <small>{badge.description}</small>}</span>
                  </li>)}
                </ul> : <p className="dashboard-muted">Complete quests to earn badges.</p>}
              <Link className="dashboard-text-link" href="/leaderboard">View leaderboard <span aria-hidden="true">→</span></Link>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
