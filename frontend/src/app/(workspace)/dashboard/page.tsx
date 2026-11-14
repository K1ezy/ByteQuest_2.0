"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest, getErrorMessage } from "@/lib/api";
import { useShellProfile } from "@/components/app-shell";

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

const localTime = (value: string) => new Date(value).toLocaleString("en-PH", {
  timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short",
});

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const profile = useShellProfile();
  const [errorStatus, setErrorStatus] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (initial = false) => {
    if (!initial) setRefreshing(true);
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
  }, []);

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

  const nextHref = data?.next_activity
    ? `/${data.next_activity.kind === "quiz" ? "quiz" : "arena"}/${data.next_activity.id}`
    : "/quests";
  const completion = data && data.total > 0 ? Math.min(100, Math.round(data.completed / data.total * 100)) : 0;
  const recentAttempts = progress?.attempts ?? [];

  return (
    <div className="page-shell pilot-dashboard dashboard-hub">
      {error && data && <p className="notice" role="status">The local ByteQuest service is unavailable. Showing your last loaded progress.</p>}

      <div className="dashboard-heading">
        <div>
          <p className="eyebrow-label">Your learning journey</p>
          <h1>Dashboard</h1>
          <p className="pilot-lead">Pick up your next quest and review your progress.</p>
        </div>
        {data && <button className="dashboard-refresh" type="button" onClick={() => void load()} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh progress"}
        </button>}
      </div>
      {loading && <p role="status">Loading your dashboard…</p>}
      {error && <div className="notice error" role="alert">{error}{" "}
        {errorStatus === 401 ? <Link href="/onboarding?mode=signin&redirect=/dashboard">Sign in again</Link>
          : errorStatus === 403 ? <Link href="/profile">Check your account</Link>
          : <button type="button" className="button button-outline" onClick={() => void load()}>Retry</button>}
      </div>}
      {data?.due_exam && (
        <section className="dashboard-exam" aria-labelledby="due-exam-priority-title">
          <div>
            <span className="dashboard-kicker">Assigned exam</span>
            <h2 id="due-exam-priority-title">{data.due_exam.title}</h2>
            <p>Closes {localTime(data.due_exam.closes_at)} (Asia/Manila)</p>
          </div>
          <Link className="button button-primary" href={`/exams/${data.due_exam.id}`}>Open exam <span aria-hidden="true">→</span></Link>
        </section>
      )}
      {data && (
        <div className="pilot-dashboard-grid">
          <div className="dashboard-main-column">
            <section className="pilot-card pilot-priority" aria-labelledby="continue-title">
              <p className="eyebrow-label">Recommended next</p>
              <h2 id="continue-title">{data.next_activity?.title || (data.total === 0 ? "Your quests are coming soon" : data.completed >= data.total ? "Your track is complete" : "No next quest available")}</h2>
              <p>{data.recommendation.rationale}</p>
              <div className="pilot-actions">
                <Link className="button button-primary" href={nextHref}>{data.next_activity ? "Continue quest" : "Explore quest map"} <span aria-hidden="true">→</span></Link>
                <Link className="button button-outline" href="/quests">Full quest map</Link>
              </div>
            </section>
            {data.pending_job_id && (
              <section className="pilot-card dashboard-pending" aria-labelledby="pending-title">
                <p className="dashboard-kicker">Submission in progress</p>
                <h2 id="pending-title">Grading in progress</h2>
                <p>Check the result when grading finishes.</p>
                <Link href={`/submissions/${data.pending_job_id}`}>View submission status</Link>
              </section>
            )}
            <section className="pilot-card dashboard-history" aria-labelledby="history-title">
              <div className="dashboard-section-heading"><h2 id="history-title">Recent attempts</h2><span>{progress ? `${progress.total_attempts} total` : "Unavailable"}</span></div>
              {recentAttempts.length ? <ul className="dashboard-attempt-list">
                {recentAttempts.map((attempt) => <li key={attempt.attempt_id}>
                  <Link href={`/${attempt.activity_type === "quiz" ? "quiz" : "arena"}/${attempt.activity_id}`}>
                    <strong>{attempt.title || (attempt.activity_type === "quiz" ? "Concept quiz" : "Code challenge")}</strong>
                    <span>{attempt.activity_type === "quiz" ? "Quiz" : "Challenge"} · {localTime(attempt.created_at)}</span>
                  </Link>
                  <span className={attempt.is_successful ? "dashboard-result passed" : "dashboard-result"}>{attempt.is_successful ? "Passed" : "Keep practicing"} · {Math.round(attempt.score_percentage)}%</span>
                </li>)}
              </ul> : <p>{progress ? "No attempts yet. Start a quest to see your work here." : "Your attempt history is currently unavailable."}</p>}
            </section>
            {data.notices?.length > 0 && (
              <section className="pilot-card">
                <h2>Notices</h2>
                {data.notices.map((notice) => (
                  <div key={notice.id} className="row">
                    <strong>{notice.subject}</strong>
                    <p>{notice.body}</p>
                  </div>
                ))}
              </section>
            )}
          </div>
          <aside className="dashboard-side-column" aria-label="Your progress and rewards">
            <section className="pilot-card dashboard-progress">
              <p className="eyebrow-label">Your progress</p>
              <h2>{completion}% complete</h2>
              <Link href="/onboarding?mode=change_track">Change learning track</Link>
              <p>{data.completed} of {data.total} published activities completed{profile ? ` · ${profile.enrolled_language.toUpperCase()} track` : ""}</p>
              <progress max={Math.max(data.total, 1)} value={data.completed} aria-label="Quest completion" />
              {data.total === 0 && <p className="dashboard-muted">Your instructor has not published activities for this track yet.</p>}
            </section>
            <section className="pilot-card dashboard-rewards">
              <p className="eyebrow-label">Rewards</p>
              <h2>Level {data.level}</h2>
              <p className="dashboard-xp">✦ {data.xp} XP</p>
              <p>{progress ? `${progress.badges.length} badge${progress.badges.length === 1 ? "" : "s"} earned` : "Badge details unavailable"}</p>
              {progress && (progress.badges.length ? <ul className="dashboard-badge-list">
                {progress.badges.map((badge) => <li key={badge.code || badge.name} title={badge.description}>✦ {badge.name}</li>)}
              </ul> : <p className="dashboard-muted">Complete quests to earn badges.</p>)}
              <Link href="/leaderboard">View leaderboard <span aria-hidden="true">→</span></Link>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

